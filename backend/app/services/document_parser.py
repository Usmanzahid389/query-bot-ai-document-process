from pathlib import Path


def extract_pages_from_file(path: Path, mime_type: str) -> list[tuple[int, str]]:
    """Return 1-based page index and text per page (single segment for txt/docx)."""
    mt = mime_type.lower()
    if mt == "text/plain" or path.suffix.lower() == ".txt":
        raw = path.read_bytes()
        text = raw.decode("utf-8", errors="replace").strip()
        return [(1, text)] if text else []
    if mt == "application/pdf" or path.suffix.lower() == ".pdf":
        import fitz  # PyMuPDF

        doc = fitz.open(path)
        try:
            out: list[tuple[int, str]] = []
            for i, page in enumerate(doc, start=1):
                t = page.get_text().strip()
                if t:
                    out.append((i, t))
            return out
        finally:
            doc.close()
    if (
        mt
        in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        )
        or path.suffix.lower() == ".docx"
    ):
        from docx import Document as DocxDocument

        doc = DocxDocument(path)
        text = "\n\n".join(p.text for p in doc.paragraphs if p.text).strip()
        return [(1, text)] if text else []
    raise ValueError(f"Unsupported file type: {mime_type}")


def extract_text_from_file(path: Path, mime_type: str) -> str:
    parts = [t for _, t in extract_pages_from_file(path, mime_type)]
    return "\n\n".join(parts).strip()
