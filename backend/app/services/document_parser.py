from __future__ import annotations

import json
import logging
import subprocess
from collections import defaultdict
from collections.abc import Iterable
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_LIBREOFFICE_SOFFICE = Path(r"C:\Program Files\LibreOffice\program\soffice.exe")

# Hybrid: merge PyMuPDF into OpenDataLoader when ODL looks light vs PyMuPDF or vs page count.
_PYMUPDF_CHAR_RATIO = 1.3  # merge if len(pym) > len(odl) * this
_ODL_MIN_LINES_PER_PAGE = 2.0  # merge if avg lines in ODL < pages * this and pym > odl

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
    """
    Plain PDF text via PyMuPDF (fallback / merge source for bullet lists).
    sort=True stabilizes reading order.
    """
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    try:
        out: list[tuple[int, str]] = []
        for i, page in enumerate(doc, start=1):
            t = ""
            try:
                t = page.get_text("text", sort=True).strip()
            except TypeError:
                t = page.get_text().strip()
            if not t:
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


def _joined_pages(pages: list[tuple[int, str]]) -> str:
    return "\n\n".join(t for _, t in pages if t).strip()


def _density_merge_wanted(
    odl_pages: list[tuple[int, str]],
    pym_pages: list[tuple[int, str]],
) -> bool:
    """
    Generic merge trigger: no document-specific keywords.
    Merge when PyMuPDF has substantially more extracted text than OpenDataLoader,
    or when ODL line density vs page count looks too sparse (likely dropped blocks).
    """
    joined_o = _joined_pages(odl_pages)
    joined_p = _joined_pages(pym_pages)
    len_o, len_p = len(joined_o), len(joined_p)
    n_pages = max(len(odl_pages), len(pym_pages), 1)

    if not joined_o.strip():
        return bool(joined_p.strip())

    # PyMuPDF extracts ~30%+ more characters → ODL likely incomplete for plain-text regions
    if len_p > len_o * _PYMUPDF_CHAR_RATIO:
        return True

    # Very few lines relative to number of pages (ODL sparse vs layout)
    line_count = joined_o.count("\n") + (1 if joined_o.strip() else 0)
    if line_count < n_pages * _ODL_MIN_LINES_PER_PAGE and len_p > len_o:
        return True

    return False


def _pages_to_dict(pages: list[tuple[int, str]]) -> dict[int, str]:
    return {n: t for n, t in pages}


def _merge_page_texts(odl: str, pym: str) -> str:
    """Append PyMuPDF lines not already present in OpenDataLoader text (same page)."""
    odl, pym = (odl or "").strip(), (pym or "").strip()
    if not pym:
        return odl
    if not odl:
        return pym
    o_lower = odl.lower()
    extra: list[str] = []
    for line in pym.splitlines():
        s = line.strip()
        if not s:
            continue
        sl = s.lower()
        if sl and sl not in o_lower:
            extra.append(line)
    if not extra:
        return odl if len(odl) >= len(pym) else pym
    return (odl + "\n" + "\n".join(extra)).strip()


def _merge_pages_odl_pym(
    odl_pages: list[tuple[int, str]],
    pym_pages: list[tuple[int, str]],
) -> list[tuple[int, str]]:
    d_o = _pages_to_dict(odl_pages)
    d_p = _pages_to_dict(pym_pages)
    keys = sorted(set(d_o) | set(d_p))
    out: list[tuple[int, str]] = []
    for k in keys:
        merged = _merge_page_texts(d_o.get(k, ""), d_p.get(k, ""))
        if merged:
            out.append((k, merged))
    return out


def _extract_pdf_hybrid(path: Path) -> list[tuple[int, str]]:
    """
    Primary: OpenDataLoader. If density check says PyMuPDF captured much more text
    (or ODL is sparse vs page count), merge PyMuPDF plain text per page.
    """
    pym_pages = _extract_pdf_pymupdf(path)
    try:
        odl_pages = _extract_pdf_opendataloader(path)
    except Exception as exc:
        logger.warning(
            "OpenDataLoader failed for %s (%s); using PyMuPDF only",
            path.name,
            exc,
        )
        return pym_pages

    joined = _joined_pages(odl_pages)
    if not joined.strip():
        logger.warning("OpenDataLoader returned no text for %s; using PyMuPDF", path.name)
        return pym_pages

    if _density_merge_wanted(odl_pages, pym_pages):
        logger.warning(
            "OpenDataLoader vs PyMuPDF density check: merging PyMuPDF into ODL for %s "
            "(ODL chars=%s, PyMuPDF chars=%s, pages=%s)",
            path.name,
            len(joined),
            len(_joined_pages(pym_pages)),
            max(len(odl_pages), len(pym_pages)),
        )
        return _merge_pages_odl_pym(odl_pages, pym_pages)

    return odl_pages


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
        if mode in ("auto", "hybrid", "opendataloader"):
            return _extract_pdf_hybrid(path)
        logger.warning("Unknown PDF_PARSER=%s; using hybrid", mode)
        return _extract_pdf_hybrid(path)
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


def convert_to_pdf(source_path: Path, output_dir: Path) -> Path | None:
    """
    Convert a DOCX file to PDF using LibreOffice headless mode.
    This keeps layout fidelity higher than hand-rolled renderers.
    """
    src = Path(source_path)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if src.suffix.lower() != ".docx":
        logger.warning("convert_to_pdf called with non-DOCX file: %s", src)
        return None

    if not src.is_file():
        logger.warning("DOCX file not found for preview conversion: %s", src)
        return None

    if not _LIBREOFFICE_SOFFICE.is_file():
        logger.warning(
            "LibreOffice not found at expected path, skipping preview conversion: %s",
            _LIBREOFFICE_SOFFICE,
        )
        return None

    cmd = [
        str(_LIBREOFFICE_SOFFICE),
        "--headless",
        "--convert-to",
        "pdf:writer_pdf_Export",
        "--outdir",
        str(out_dir),
        str(src),
    ]
    try:
        subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.CalledProcessError as exc:
        logger.warning(
            "DOCX->PDF conversion failed for %s: %s",
            src.name,
            (exc.stderr or exc.stdout or str(exc)).strip(),
        )
        return None
    except subprocess.TimeoutExpired:
        logger.warning("DOCX->PDF conversion timed out for %s", src.name)
        return None
    except Exception:
        logger.exception("Unexpected error during DOCX->PDF conversion for %s", src.name)
        return None

    pdf_path = out_dir / f"{src.stem}.pdf"
    if not pdf_path.is_file():
        logger.warning("Expected converted PDF not found: %s", pdf_path)
        return None
    return pdf_path
