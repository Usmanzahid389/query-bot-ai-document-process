from __future__ import annotations

import json
import logging
from collections import defaultdict
from collections.abc import Iterable
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_CONTENT_TYPES = frozenset(
    {
        "paragraph",
        "heading",
        "list",
        "list_item",
        "table",
        "caption",
    }
)


def _extract_pdf_pymupdf(path: Path) -> list[tuple[int, str]]:
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


def _page_num(el: dict) -> int:
    p = el.get("page number") if "page number" in el else el.get("page_number")
    if p is None:
        return 1
    try:
        return int(p)
    except (TypeError, ValueError):
        return 1


def _element_text(el: dict) -> str:
    c = el.get("content")
    if c is None:
        return ""
    if isinstance(c, str):
        return c.strip()
    if isinstance(c, dict):
        try:
            s = json.dumps(c, ensure_ascii=False)
        except (TypeError, ValueError):
            s = str(c)
        return s[:12000] if len(s) > 12000 else s
    if isinstance(c, list):
        parts: list[str] = []
        for x in c:
            if isinstance(x, dict):
                parts.append(_element_text(x))
            else:
                parts.append(str(x).strip())
        return "\n".join(p for p in parts if p).strip()
    return str(c).strip()


def _should_include(el: dict) -> bool:
    t = (el.get("type") or "").lower()
    if t in _CONTENT_TYPES:
        return True
    if t in ("image", "figure"):
        return bool(_element_text(el))
    return bool(_element_text(el))


def _walk_elements(doc: dict) -> Iterable[dict]:
    """Depth-first walk of `kids` trees, preserving sibling order."""

    def walk(node: dict) -> Iterable[dict]:
        for child in node.get("kids") or []:
            if not isinstance(child, dict):
                continue
            yield child
            yield from walk(child)

    yield from walk(doc)


def _pages_from_opendataloader_json(data: dict) -> list[tuple[int, str]]:
    by_page: dict[int, list[str]] = defaultdict(list)
    for el in _walk_elements(data):
        if not _should_include(el):
            continue
        text = _element_text(el)
        if not text:
            continue
        by_page[_page_num(el)].append(text)
    out: list[tuple[int, str]] = []
    for page_num in sorted(by_page.keys()):
        merged = "\n\n".join(by_page[page_num]).strip()
        if merged:
            out.append((page_num, merged))
    return out


def _extract_pdf_opendataloader(path: Path) -> list[tuple[int, str]]:
    import tempfile

    import opendataloader_pdf

    with tempfile.TemporaryDirectory(prefix="odl_") as tmp:
        out_dir = Path(tmp)
        opendataloader_pdf.convert(
            input_path=str(path),
            output_dir=str(out_dir),
            format="json",
            quiet=True,
        )
        json_files = sorted(out_dir.glob("*.json"))
        if not json_files:
            raise ValueError("OpenDataLoader produced no JSON output")
        preferred = [f for f in json_files if f.stem == path.stem]
        jf = preferred[0] if preferred else json_files[0]
        raw = jf.read_text(encoding="utf-8", errors="replace")
        data = json.loads(raw)
    pages = _pages_from_opendataloader_json(data)
    if not pages:
        raise ValueError("OpenDataLoader JSON contained no extractable text")
    return pages


def extract_pages_from_file(path: Path, mime_type: str) -> list[tuple[int, str]]:
    """Return 1-based page index and text per page (single segment for txt/docx)."""
    mt = mime_type.lower()
    if mt == "text/plain" or path.suffix.lower() == ".txt":
        raw = path.read_bytes()
        text = raw.decode("utf-8", errors="replace").strip()
        return [(1, text)] if text else []
    if mt == "application/pdf" or path.suffix.lower() == ".pdf":
        mode = (settings.pdf_parser or "auto").strip().lower()
        if mode == "pymupdf":
            return _extract_pdf_pymupdf(path)
        if mode == "opendataloader":
            return _extract_pdf_opendataloader(path)
        # auto
        try:
            return _extract_pdf_opendataloader(path)
        except Exception as exc:
            logger.warning(
                "OpenDataLoader PDF parse failed (%s); falling back to PyMuPDF. "
                "Install Java and set PATH if you want OpenDataLoader.",
                exc,
            )
            return _extract_pdf_pymupdf(path)
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
