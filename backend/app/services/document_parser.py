from pathlib import Path


def extract_text_from_file(path: Path, mime_type: str) -> str:
    mt = mime_type.lower()
    if mt == "text/plain" or path.suffix.lower() == ".txt":
        raw = path.read_bytes()
        return raw.decode("utf-8", errors="replace")
    if mt == "application/pdf" or path.suffix.lower() == ".pdf":
        return _pdf_text(path)
    if (
        mt
        in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        )
        or path.suffix.lower() == ".docx"
    ):
        return _docx_text(path)
    raise ValueError(f"Unsupported file type: {mime_type}")


def _pdf_text(path: Path) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    try:
        parts: list[str] = []
        for page in doc:
            parts.append(page.get_text())
        return "\n\n".join(parts).strip()
    finally:
        doc.close()


def _docx_text(path: Path) -> str:
    from docx import Document as DocxDocument

    doc = DocxDocument(path)
    return "\n\n".join(p.text for p in doc.paragraphs if p.text).strip()
