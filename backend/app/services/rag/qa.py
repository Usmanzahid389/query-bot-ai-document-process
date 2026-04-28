from __future__ import annotations

import uuid

from app.core.config import settings
from app.services.rag.chroma_store import query_similar
from app.services.rag.llm_client import chat_completion

# _SYSTEM_QA = """You are QueryBot. Answer using ONLY the CONTEXT below. If the answer is not in the context, say you could not find it in the documents.
# Use short numbered citations like [1], [2] matching chunk numbers in the context."""

_SYSTEM_QA = """You are QueryBot, a professional Data Analyst. 

Your task is to answer user questions using ONLY the CONTEXT provided. 

CRITICAL GUIDELINES:
1. DATA EXTRACTION: If the user asks about a person, ID, or specific item (e.g., 'Who is X' or 'Details of Y'), scan the context for any matching row or structured list.
2. TABLE DATA: If the matching info is in a table-like format, extract and present ALL associated values (e.g., Form Number, Campus, Program, Marks, Status). 
3. FORMATTING: Present structured data in a clean, bulleted list or a small table.
4. NO BIOGRAPHIES: If the context contains a row with result data, do not say "I couldn't find a description." Instead, provide the data from that row.
5. CITATIONS: Use short numbered citations like [1], [2] matching chunk numbers in the context.
6. FALLBACK: If the answer is truly not in the context, say you could not find it."""


def _format_context(chunks: list[str]) -> str:
    parts: list[str] = []
    for i, text in enumerate(chunks, start=1):
        parts.append(f"[{i}] {text}")
    return "\n\n".join(parts)


def _sources_from_metas(metas: list[dict], chunks: list[str]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for i, content in enumerate(chunks, start=1):
        meta = metas[i - 1] if i - 1 < len(metas) else {}
        out.append(
            {
                "index": i,
                "page_number": meta.get("page"),
                "file_name": meta.get("file_name"),
                "content": content,
            }
        )
    return out


def answer_question(
    user_id: uuid.UUID,
    document_ids: list[uuid.UUID],
    question: str,
) -> dict[str, object]:
    if not settings.rag_enabled or not (settings.llm_api_key or "").strip():
        raise ValueError("RAG or LLM not configured")
    k = max(1, int(settings.rag_top_k))
    chunks, metas = query_similar(
        user_id=user_id,
        document_ids=document_ids,
        question=question,
        top_k=k,
    )
    if not chunks:
        return {
            "answer": "I could not find relevant passages in the indexed documents for this question. Try re-uploading or use Reindex if you changed parsers.",
            "sources": [],
        }
    ctx = _format_context(chunks)
    user_msg = f"CONTEXT:\n{ctx}\n\nQUESTION:\n{question}"
    answer = chat_completion(system_prompt=_SYSTEM_QA, user_message=user_msg)
    sources = _sources_from_metas(metas, chunks)
    return {"answer": answer, "sources": sources}


_SUMMARY_SYSTEM = """You are QueryBot. Summarize the CONTEXT into: brief overview, key points, takeaways. Use only the context."""


def summarize_document(
    user_id: uuid.UUID,
    document_id: uuid.UUID,
    document_title: str,
) -> str:
    if not settings.rag_enabled or not (settings.llm_api_key or "").strip():
        raise ValueError("RAG or LLM not configured")
    q = "Summarize the document: main themes, key facts, and practical takeaways."
    k = max(int(settings.rag_top_k), 12)
    chunks, _ = query_similar(user_id=user_id, document_ids=[document_id], question=q, top_k=k)
    if not chunks:
        return "No indexed content found for this document. Try uploading again or run reindex."
    ctx = _format_context(chunks)
    user_msg = f"Document title: {document_title}\n\nCONTEXT:\n{ctx}"
    return chat_completion(system_prompt=_SUMMARY_SYSTEM, user_message=user_msg)
