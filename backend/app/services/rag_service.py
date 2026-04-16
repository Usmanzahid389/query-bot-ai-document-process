from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Sequence

from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document as LCDocument
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings

logger = logging.getLogger(__name__)

_embedding_model: HuggingFaceEmbeddings | None = None
_vectorstore: Chroma | None = None


def _get_embeddings() -> HuggingFaceEmbeddings:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbeddings(
            model_name=settings.embedding_model_id,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embedding_model


def _get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
        _vectorstore = Chroma(
            collection_name=settings.chroma_collection,
            embedding_function=_get_embeddings(),
            persist_directory=str(settings.chroma_dir),
        )
    return _vectorstore


def _splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
    )


def _build_where(user_id: uuid.UUID, document_ids: list[uuid.UUID]) -> dict:
    uid = str(user_id)
    if len(document_ids) == 1:
        return {
            "$and": [
                {"user_id": {"$eq": uid}},
                {"document_id": {"$eq": str(document_ids[0])}},
            ]
        }
    ors = [{"document_id": {"$eq": str(did)}} for did in document_ids]
    return {"$and": [{"user_id": {"$eq": uid}}, {"$or": ors}]}


def delete_document_index(document_id: uuid.UUID) -> None:
    vs = _get_vectorstore()
    try:
        vs.delete(where={"document_id": str(document_id)})
    except Exception:
        logger.exception("Chroma delete failed for document_id=%s", document_id)


def index_document(
    user_id: uuid.UUID,
    document_id: uuid.UUID,
    original_filename: str,
    pages: Sequence[tuple[int, str]],
) -> None:
    delete_document_index(document_id)
    splitter = _splitter()
    docs: list[LCDocument] = []
    for page_num, text in pages:
        t = (text or "").strip()
        if not t:
            continue
        for chunk in splitter.split_text(t):
            c = chunk.strip()
            if not c:
                continue
            docs.append(
                LCDocument(
                    page_content=c,
                    metadata={
                        "user_id": str(user_id),
                        "document_id": str(document_id),
                        "page": int(page_num),
                        "source": (original_filename or "")[:256],
                    },
                )
            )
    if not docs:
        return
    vs = _get_vectorstore()
    vs.add_documents(docs)


def _retrieve(
    user_id: uuid.UUID, document_ids: list[uuid.UUID], query: str, k: int
) -> list[LCDocument]:
    vs = _get_vectorstore()
    return vs.similarity_search(
        query,
        k=k,
        filter=_build_where(user_id, document_ids),
    )


def _format_context(chunks: list[LCDocument]) -> str:
    parts: list[str] = []
    for i, d in enumerate(chunks, start=1):
        meta = d.metadata or {}
        src = meta.get("source", "?")
        page = meta.get("page", "?")
        parts.append(f"[{i}] Source: {src} | Page: {page}\n{d.page_content}")
    return "\n\n---\n\n".join(parts)


def _llm() -> ChatOpenAI:
    return ChatOpenAI(
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        temperature=0.15,
        timeout=settings.llm_timeout_seconds,
    )


def _message_content(out: object) -> str:
    raw = getattr(out, "content", None) if out is not None else None
    if raw is None:
        return str(out) if out is not None else ""
    if isinstance(raw, list):
        parts: list[str] = []
        for block in raw:
            if isinstance(block, dict) and "text" in block:
                parts.append(str(block["text"]))
            else:
                parts.append(str(block))
        text = "".join(parts)
    else:
        text = str(raw)
    return text.replace("\x00", "")


def _is_rate_limited_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "rate limit" in msg or "rate-limited" in msg


def _invoke_with_retries(chain, payload: dict[str, str], retries: int = 2) -> object:
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return chain.invoke(payload)
        except Exception as exc:
            last_exc = exc
            if attempt >= retries or not _is_rate_limited_error(exc):
                raise
            sleep_s = 1.5 * (attempt + 1)
            logger.warning(
                "LLM rate limited (attempt %s/%s). Retrying in %.1fs",
                attempt + 1,
                retries + 1,
                sleep_s,
            )
            time.sleep(sleep_s)
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("LLM call failed without an exception")


def answer_question(
    user_id: uuid.UUID,
    docs: list,
    question: str,
) -> str:
    ids = [d.id for d in docs]
    chunks = _retrieve(user_id, ids, question, settings.rag_top_k)
    if not chunks:
        for d in docs:
            index_document(
                user_id,
                d.id,
                d.original_filename,
                [(1, d.extracted_text or "")],
            )
        chunks = _retrieve(user_id, ids, question, settings.rag_top_k)
    if not chunks:
        return (
            "I couldn’t find anything relevant in your uploaded document for this question. "
            "The file might be empty, mostly images (scanned PDF without OCR), or the topic may not appear in the text."
        )

    context = _format_context(chunks)
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "human",
                "You are a helpful assistant answering from the user’s uploaded document.\n\n"
                "Rules:\n"
                "- Use ONLY the CONTEXT below. Do not invent facts or use outside knowledge.\n"
                "- If the answer is not clearly supported by the context, say you can’t find it in the document.\n"
                "- Write in a clear, friendly tone. Short paragraphs or bullet points are fine when they help readability.\n"
                "- When you use specific information, cite the chunk number from the context in brackets, e.g. [1] or [2].\n"
                "- If the context only partially answers the question, say what you can confirm and what is missing.\n\n"
                "CONTEXT:\n{context}\n\nQUESTION:\n{question}",
            ),
        ]
    )
    chain = prompt | _llm()
    out = _invoke_with_retries(chain, {"context": context, "question": question})
    return _message_content(out)


def summarize_document_rag(
    user_id: uuid.UUID,
    document_id: uuid.UUID,
    document_title: str,
    extracted_text: str,
) -> str:
    q = (
        "Provide a structured summary with: brief overview, key points, and practical takeaways. "
        "Use only the provided context."
    )
    chunks = _retrieve(user_id, [document_id], q, settings.rag_summary_top_k)
    if not chunks:
        index_document(user_id, document_id, document_title, [(1, extracted_text or "")])
        chunks = _retrieve(user_id, [document_id], q, settings.rag_summary_top_k)
    if not chunks:
        return "No text available to summarize."

    context = _format_context(chunks)
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "human",
                "Summarize ONLY from the CONTEXT below. Do not add outside facts. "
                "If the context is too thin to summarize meaningfully, say so briefly.\n"
                "Use clear, friendly language and short sections where helpful.\n\n"
                "Document title: {title}\n\nCONTEXT:\n{context}\n\nWrite the summary.",
            ),
        ]
    )
    chain = prompt | _llm()
    out = _invoke_with_retries(chain, {"title": document_title, "context": context})
    return _message_content(out)
