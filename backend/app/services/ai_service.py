"""
Legacy MVP mocks are kept below (commented). Production paths use rag_service:
Chroma vector store, Hugging Face sentence-transformers embeddings, OpenRouter LLM.
"""

from __future__ import annotations

# -----------------------------------------------------------------------------
# Legacy mocks (MVP) — not used by routes after RAG integration
# -----------------------------------------------------------------------------
#
# def mock_answer(
#     question: str,
#     document_names: list[str],
#     snippet_context: str,
# ) -> str:
#     names = ", ".join(document_names) if document_names else "your document(s)"
#     snippet = (snippet_context[:400] + "…") if len(snippet_context) > 400 else snippet_context
#     return (
#         f"[Mock answer] Based on **{names}**, here is a concise response to: “{question.strip()[:200]}”. "
#         f"In the excerpt below, the material appears relevant to your question; a full RAG pipeline would "
#         f"rank and cite specific passages.\n\n"
#         f"**Context used (preview):** {snippet or '(no text extracted)'}\n\n"
#         "This is a placeholder response for MVP integration testing."
#     )
#
#
# def mock_summary(document_title: str, excerpt: str) -> str:
#     ex = excerpt[:600] if excerpt else "(empty document)"
#     return (
#         f"**Paragraph 1 — Overview**\n"
#         f"This mock summary describes “{document_title}”. In production, this section would synthesize "
#         f"the main thesis and scope using retrieved chunks from the full text.\n\n"
#         f"**Paragraph 2 — Key points**\n"
#         f"Key ideas would be listed here. For demonstration, the first part of extracted text begins: "
#         f"{ex[:300]}{'…' if len(ex) > 300 else ''}\n\n"
#         f"**Paragraph 3 — Takeaways**\n"
#         f"Final notes would highlight implications, limitations, and follow-up questions. "
#         f"This structured three-paragraph summary is fixed for MVP testing only."
#     )
