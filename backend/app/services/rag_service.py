from __future__ import annotations

import logging
import random
import re
import time
import uuid
from collections.abc import Sequence

from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document as LCDocument
from langchain_core.embeddings import Embeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are QueryBot, a professional and helpful AI Document Assistant.

### 1. GREETING & GENERAL QUERIES (No Context Required)
- If the user provides a greeting (e.g., Hi, Hello, Hey, How are you?) or Islamic greetings (e.g., Salam, AOA, Assalam o Alaikum):
  - For Islamic greetings, ALWAYS start with 'Wa alaikum assalam'.
  - Provide a warm, brief response as QueryBot.
  - Example: 'Wa alaikum assalam. I am QueryBot, your AI document assistant. How can I help you today?'
- If asked 'Who are you?' or 'What can you do?', explain that you analyze documents (PDFs), provide summaries, and answer questions using accurate citations.
- CRITICAL: Never use citation brackets like [1] or [2] in these general replies. Do not search or quote the CONTEXT for these.

### 2. DOCUMENT SPECIFIC QUERIES (Context Required)
- Use ONLY the provided CONTEXT block to answer questions about the files.
- You MUST provide citations using numbered brackets like [1] or [1, 2] at the end of the relevant sentences.
- Use the exact index number from the context (e.g., Chunk [1] becomes citation [1]).
- DO NOT mention filenames, 'Source:', or 'Page:' in the text—only use the brackets [n].
- If the answer is not in the context, say: 'I'm sorry, I couldn't find that specific information in the uploaded documents.'

### 3. FORMATTING RULES
- Maintain professional tone.
- Use bullet points for lists to keep answers readable.
- Ensure citations are placed BEFORE the final period of a sentence if possible, e.g., '...as mentioned in the proposal [1].'"""

_STOP_WORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "is",
        "are",
        "was",
        "what",
        "when",
        "where",
        "which",
        "this",
        "that",
        "from",
        "with",
        "about",
        "into",
        "does",
        "did",
        "how",
        "why",
        "you",
        "your",
        "me",
        "my",
        "we",
        "they",
        "it",
        "its",
        "as",
        "by",
        "be",
        "been",
        "have",
        "has",
        "can",
        "could",
        "would",
        "should",
        "tell",
        "give",
        "list",
        "need",
        "want",
        "please",
        "just",
        "all",
        "any",
        "some",
        "there",
        "here",
        "than",
        "then",
        "only",
        "also",
        "not",
        "mujhe",
        "hai",
        "hain",
        "ke",
        "aur",
        "ko",
        "se",
        "par",
        "main",
        "kya",
        "poori",
        "likha",
        "bare",
        "mein",
    }
)

_embedding_model: HuggingFaceEmbeddings | None = None
_vectorstore: Chroma | None = None
_SECTION_HEADER_RE = re.compile(r"(?im)^(?:\d+(?:\.\d+)*)\s+[A-Z][^\n]{2,}$")
_FLOW_QUERY_RE = re.compile(
    r"(?i)\b(steps?|step-by-step|process|workflow|procedure)\b"
)
_SMALL_TALK_RE = re.compile(
    r"(?i)^\s*(hi|hello|hey|salam|salaam|aoa|a\.o\.a|assalam\s*o\s*alaikum|assalamualaikum|assalamu\s*alaikum|"
    r"how are you|how r you|what's up|whats up|who are you|what are you|what can you do|what do you do)\b[!?.,\s]*$"
)
_ISLAMIC_GREETING_RE = re.compile(
    r"(?i)^\s*(aoa|a\.o\.a|assalam\s*o\s*alaikum|assalamualaikum|assalamu\s*alaikum|salam|salaam)\s*[!?.]*$"
)
_THANKS_BYE_RE = re.compile(
    r"(?i)^\s*(thanks|thank you|thx|ty|bye|goodbye|good morning|good afternoon|good evening)\s*[!?.,\s]*$"
)


class _PrefixedEmbeddings(Embeddings):
    """
    Wrap base embeddings to optionally prefix query/document text.
    Useful for retrieval-optimized models such as BGE.
    """

    def __init__(self, base: HuggingFaceEmbeddings, query_prefix: str, document_prefix: str):
        self._base = base
        self._query_prefix = query_prefix or ""
        self._document_prefix = document_prefix or ""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if self._document_prefix:
            texts = [f"{self._document_prefix}{t}" for t in texts]
        return self._base.embed_documents(texts)

    def embed_query(self, text: str) -> list[float]:
        if self._query_prefix:
            text = f"{self._query_prefix}{text}"
        return self._base.embed_query(text)


def _resolved_embedding_prefixes() -> tuple[str, str]:
    q = settings.embedding_query_prefix or ""
    d = settings.embedding_document_prefix or ""
    mid = (settings.embedding_model_id or "").lower()
    # BGE retrieval guidance: query instruction helps recall; passages usually stay plain.
    if settings.embedding_auto_prefix_bge and not q and "bge" in mid:
        q = "Represent this sentence for searching relevant passages: "
    return q, d


def _get_embeddings() -> Embeddings:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbeddings(
            model_name=settings.embedding_model_id,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    query_prefix, document_prefix = _resolved_embedding_prefixes()
    if query_prefix or document_prefix:
        return _PrefixedEmbeddings(_embedding_model, query_prefix, document_prefix)
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
        chunk_size=int(settings.rag_chunk_size),
        chunk_overlap=int(settings.rag_chunk_overlap),
        separators=[
            "\n## ",
            "\n### ",
            "\n#### ",
            "\n##### ",
            "\n\n",
            "\n",
            " ",
            "",
        ],
    )


def _split_text_by_headers(text: str) -> list[str]:
    """
    Split page text into section-aware blocks so numbered headers do not bleed
    into neighboring sections (e.g. "8 Tools and Technology" vs "10 References").
    """
    t = (text or "").strip()
    if not t:
        return []
    matches = list(_SECTION_HEADER_RE.finditer(t))
    if not matches:
        return [t]
    parts: list[str] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(t)
        block = t[start:end].strip()
        if block:
            parts.append(block)
    prefix = t[: matches[0].start()].strip()
    if prefix:
        parts.insert(0, prefix)
    return parts


def _build_where(
    user_id: uuid.UUID,
    document_ids: list[uuid.UUID],
    *,
    page: int | None = None,
) -> dict:
    uid = str(user_id)
    if len(document_ids) == 1:
        parts: list[dict] = [
            {"user_id": {"$eq": uid}},
            {"document_id": {"$eq": str(document_ids[0])}},
        ]
        if page is not None:
            parts.append({"page": int(page)})
        return {"$and": parts}
    ors = [{"document_id": {"$eq": str(did)}} for did in document_ids]
    parts = [{"user_id": {"$eq": uid}}, {"$or": ors}]
    if page is not None:
        parts.append({"page": int(page)})
    return {"$and": parts}


def _parse_focus_page(query: str) -> int | None:
    """1-based page index from natural language, e.g. 'page 7', 'on page 3', 'p.12'."""
    patterns = (
        r"(?i)\bpage\s+no\.?\s*(\d+)\b",
        r"(?i)\bpage\s+number\s*(\d+)\b",
        r"(?i)\bon\s+page\s+(\d+)\b",
        r"(?i)\bpage\s*[:#]?\s*(\d+)\b",
        r"(?i)\bp\.{0,2}\s*(\d+)\b",
    )
    for pat in patterns:
        m = re.search(pat, query)
        if m:
            n = int(m.group(1))
            return n if n > 0 else None
    return None


def _query_wants_flow_or_steps(query: str) -> bool:
    return bool(_FLOW_QUERY_RE.search(query))


def _qa_retrieval_plan(question: str) -> tuple[int, int, int | None, bool | None]:
    """(final_k, fetch_k, page_filter or None, use_mmr override)."""
    page = _parse_focus_page(question)
    if page is not None:
        fk = max(int(settings.rag_fetch_k), int(settings.rag_page_retrieval_k))
        return int(settings.rag_page_retrieval_k), fk, page, False
    if _query_wants_flow_or_steps(question):
        fk = max(int(settings.rag_fetch_k), 72)
        return max(int(settings.rag_qa_top_k), 12), fk, None, settings.rag_qa_use_mmr
    fk = max(int(settings.rag_fetch_k), int(settings.rag_qa_top_k))
    return int(settings.rag_qa_top_k), fk, None, settings.rag_qa_use_mmr


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
    full_text = "\n\n".join((txt or "").strip() for _, txt in pages if (txt or "").strip())
    if full_text:
        lowered = full_text.lower()
        if "react" not in lowered and "next.js" not in lowered and "nextjs" not in lowered:
            logger.warning(
                "Index pre-check: expected frontend keywords not found in extracted text "
                "for document_id=%s (React/Next.js missing).",
                document_id,
            )
    for page_num, text in pages:
        t = (text or "").strip()
        if not t:
            continue
        section_blocks = _split_text_by_headers(t)
        for block in section_blocks:
            for chunk in splitter.split_text(block):
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


def _retrieve_context(
    user_id: uuid.UUID,
    document_ids: list[uuid.UUID],
    query: str,
    *,
    final_k: int,
    fetch_k: int,
    use_mmr: bool | None = None,
    page: int | None = None,
) -> list[LCDocument]:
    """
    Retrieve chunks for the LLM.
    - MMR: diverse chunks (good for summaries / comparing distant ideas).
    - Similarity only: top final_k by embedding match (better for exhaustive lists in one section).
    - page: when set, filter to that PDF page and disable MMR so dense on-page lists stay together.
    """
    where = _build_where(user_id, document_ids, page=page)
    fk = max(int(fetch_k), int(final_k))
    vs = _get_vectorstore()
    want_mmr = settings.rag_mmr_enabled if use_mmr is None else use_mmr
    if page is not None:
        want_mmr = False
    if want_mmr and fk > final_k:
        try:
            results = vs.max_marginal_relevance_search(
                query,
                k=final_k,
                fetch_k=fk,
                lambda_mult=settings.rag_mmr_lambda,
                filter=where,
            )
            return _dedupe_chunks_by_content(results)
        except Exception:
            logger.exception("MMR retrieval failed; falling back to similarity search")
    results = vs.similarity_search(query, k=final_k, filter=where)
    return _dedupe_chunks_by_content(results)


def _dedupe_chunks_by_content(chunks: list[LCDocument]) -> list[LCDocument]:
    """Remove duplicate retrieved chunks by normalized page_content text."""
    seen: set[str] = set()
    unique: list[LCDocument] = []
    for d in chunks:
        normalized = re.sub(r"\s+", " ", (d.page_content or "")).strip().lower()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(d)
    return unique


def _summary_fetch_k() -> int:
    return max(settings.rag_summary_fetch_k or settings.rag_fetch_k, settings.rag_summary_top_k)


def _format_context(chunks: list[LCDocument]) -> str:
    parts: list[str] = []
    for i, d in enumerate(chunks, start=1):
        parts.append(f"[Chunk {i}]: {d.page_content}")
    return "\n\n---\n\n".join(parts)


def _build_sources(chunks: list[LCDocument]) -> list[dict[str, object]]:
    sources: list[dict[str, object]] = []
    for i, d in enumerate(chunks, start=1):
        meta = d.metadata or {}
        sources.append(
            {
                "index": i,
                "page_number": meta.get("page"),
                "file_name": meta.get("source"),
                "content": d.page_content,
            }
        )
    return sources


def _rerank_chunks_query_focus(question: str, chunks: list[LCDocument]) -> list[LCDocument]:
    """
    Light re-ranking: boost chunks that match query terms / bigrams. Same chunk count
    is returned (no aggressive filtering) — only order changes so diagram / step labels
    align better with the question.
    """
    if len(chunks) <= 1:
        return chunks
    raw_tokens = re.findall(r"[A-Za-zÀ-ÿ0-9]+", (question or "").lower())
    terms = [t for t in raw_tokens if len(t) > 2 and t not in _STOP_WORDS][:28]
    if not terms:
        return chunks
    bigrams = list(zip(terms, terms[1:]))
    scored: list[tuple[float, int, LCDocument]] = []
    for orig_i, d in enumerate(chunks):
        norm = re.sub(r"\s+", " ", (d.page_content or "").lower())
        score = 0.0
        for t in terms:
            c = norm.count(t)
            if c:
                score += c * (3.5 if len(t) > 5 else 2.5)
        for a, b in bigrams:
            if a in norm and b in norm:
                score += 6.0
        scored.append((score, -orig_i, d))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [t[2] for t in scored]


def _llm(*, max_tokens: int | None = None) -> ChatOpenAI:
    kw: dict = {
        "base_url": settings.llm_base_url,
        "model": settings.llm_model,
        "api_key": settings.llm_api_key,
        "temperature": 0.05,
        "timeout": settings.llm_timeout_seconds,
    }
    if max_tokens is not None:
        kw["max_tokens"] = max_tokens
    return ChatOpenAI(**kw)


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


def _is_general_conversation(question: str) -> bool:
    """Whole-message meta/greetings: no retrieval, no citations."""
    q = (question or "").strip()
    if not q:
        return False
    return bool(
        _ISLAMIC_GREETING_RE.match(q)
        or _SMALL_TALK_RE.match(q)
        or _THANKS_BYE_RE.match(q)
    )


_GENERAL_CONTEXT_PLACEHOLDER = (
    "[No document context — general conversation only. Do not cite this line.]"
)


def _pace_small_talk_reply() -> None:
    """Occasional short pause so casual replies do not feel instant every time."""
    r = random.random()
    if r < 0.35:
        time.sleep(random.uniform(0.05, 0.18))
    elif r < 0.75:
        time.sleep(random.uniform(0.45, 0.95))
    else:
        time.sleep(random.uniform(1.0, 1.65))


def answer_question(
    user_id: uuid.UUID,
    docs: list,
    question: str,
) -> dict[str, object]:
    if _is_general_conversation(question):
        _pace_small_talk_reply()
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", SYSTEM_PROMPT),
                ("human", "CONTEXT:\n{context}\n\nQUESTION:\n{question}"),
            ]
        )
        chain = prompt | _llm(max_tokens=384)
        out = _invoke_with_retries(
            chain, {"context": _GENERAL_CONTEXT_PLACEHOLDER, "question": question}
        )
        return {"answer": _message_content(out), "sources": []}

    ids = [d.id for d in docs]
    final_k, fetch_k, page_filter, use_mmr = _qa_retrieval_plan(question)
    chunks = _retrieve_context(
        user_id,
        ids,
        question,
        final_k=final_k,
        fetch_k=fetch_k,
        use_mmr=use_mmr,
        page=page_filter,
    )
    if not chunks:
        for d in docs:
            index_document(
                user_id,
                d.id,
                d.original_filename,
                [(1, d.extracted_text or "")],
            )
        chunks = _retrieve_context(
            user_id,
            ids,
            question,
            final_k=final_k,
            fetch_k=fetch_k,
            use_mmr=use_mmr,
            page=page_filter,
        )
    if not chunks:
        return {
            "answer": (
                "I couldn’t find anything relevant in your uploaded document for this question. "
                "The file might be empty, mostly images (scanned PDF without OCR), or the topic may not appear in the text."
            ),
            "sources": [],
        }

    chunks = _rerank_chunks_query_focus(question, chunks)
    context = _format_context(chunks)
    sources = _build_sources(chunks)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            (
                "human",
                "CONTEXT:\n{context}\n\nQUESTION:\n{question}",
            ),
        ]
    )
    chain = prompt | _llm(max_tokens=768)
    out = _invoke_with_retries(chain, {"context": context, "question": question})
    return {"answer": _message_content(out), "sources": sources}


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
    chunks = _retrieve_context(
        user_id,
        [document_id],
        q,
        final_k=settings.rag_summary_top_k,
        fetch_k=_summary_fetch_k(),
    )
    if not chunks:
        index_document(user_id, document_id, document_title, [(1, extracted_text or "")])
        chunks = _retrieve_context(
            user_id,
            [document_id],
            q,
            final_k=settings.rag_summary_top_k,
            fetch_k=_summary_fetch_k(),
        )
    if not chunks:
        return "No text available to summarize."

    chunks = _rerank_chunks_query_focus(f"{document_title} {q}", chunks)
    context = _format_context(chunks)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            (
                "human",
                "Document title: {title}\n\nCONTEXT:\n{context}\n\n"
                "Write a concise summary: brief overview, key points, practical takeaways. "
                "Use only the CONTEXT. If the context is too thin, say so in one sentence.",
            ),
        ]
    )
    chain = prompt | _llm(max_tokens=900)
    out = _invoke_with_retries(chain, {"title": document_title, "context": context})
    return _message_content(out)
