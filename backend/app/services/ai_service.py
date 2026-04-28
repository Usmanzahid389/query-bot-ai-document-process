from __future__ import annotations


def mock_answer(
    question: str,
    document_names: list[str],
    snippet_context: str,
) -> str:
    names = ", ".join(document_names) if document_names else "your document(s)"
    snippet = (snippet_context[:500] + "...") if len(snippet_context) > 500 else snippet_context
    return (
        f"Document AI is in fallback mode. This is a mock reply for: '{question.strip()[:200]}'.\n\n"
        f"Documents selected: {names}\n"
        f"Extracted text preview: {snippet or '(no text extracted)'}"
    )


def mock_summary(document_title: str, excerpt: str) -> str:
    ex = excerpt[:700] if excerpt else "(empty document)"
    return (
        f"Document AI is in fallback mode, so this is a basic summary for '{document_title}'.\n\n"
        f"Text preview:\n{ex}"
    )
