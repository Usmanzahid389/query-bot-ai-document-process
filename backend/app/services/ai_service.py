"""
MVP: all AI output is mocked. Replace implementations here with LangChain/RAG later;
routes should not change.
"""

from __future__ import annotations


def mock_answer(
    question: str,
    document_names: list[str],
    snippet_context: str,
) -> str:
    names = ", ".join(document_names) if document_names else "your document(s)"
    snippet = (snippet_context[:400] + "…") if len(snippet_context) > 400 else snippet_context
    return (
        f"[Mock answer] Based on **{names}**, here is a concise response to: “{question.strip()[:200]}”. "
        f"In the excerpt below, the material appears relevant to your question; a full RAG pipeline would "
        f"rank and cite specific passages.\n\n"
        f"**Context used (preview):** {snippet or '(no text extracted)'}\n\n"
        "This is a placeholder response for MVP integration testing."
    )


def mock_summary(document_title: str, excerpt: str) -> str:
    ex = excerpt[:600] if excerpt else "(empty document)"
    return (
        f"**Paragraph 1 — Overview**\n"
        f"This mock summary describes “{document_title}”. In production, this section would synthesize "
        f"the main thesis and scope using retrieved chunks from the full text.\n\n"
        f"**Paragraph 2 — Key points**\n"
        f"Key ideas would be listed here. For demonstration, the first part of extracted text begins: "
        f"{ex[:300]}{'…' if len(ex) > 300 else ''}\n\n"
        f"**Paragraph 3 — Takeaways**\n"
        f"Final notes would highlight implications, limitations, and follow-up questions. "
        f"This structured three-paragraph summary is fixed for MVP testing only."
    )


def mock_compare(
    doc_a_title: str,
    doc_b_title: str,
    excerpt_a: str,
    excerpt_b: str,
) -> str:
    a = excerpt_a[:350] + ("…" if len(excerpt_a) > 350 else "")
    b = excerpt_b[:350] + ("…" if len(excerpt_b) > 350 else "")
    return (
        f"**Similarities (mock)**\n"
        f"Both “{doc_a_title}” and “{doc_b_title}” are being compared in QueryBot MVP mode. "
        f"A future version would embed both documents and list thematic overlap.\n\n"
        f"**Differences (mock)**\n"
        f"Side A emphasizes content starting with: {a or '(empty)'}\n"
        f"Side B emphasizes content starting with: {b or '(empty)'}\n\n"
        f"**Note:** This analysis is hardcoded for MVP; replace `mock_compare` in `ai_service.py` for real insights."
    )
