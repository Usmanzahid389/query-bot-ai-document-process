from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID

from app.schemas.document_blocks import DocumentBlock, ParsedDocument
from app.services.parsers.base_parser import BaseParser
from app.services.parsers.fallback_parser import FallbackParser
from app.services.parsers.normalize_blocks import build_block_id, normalize_blocks

logger = logging.getLogger(__name__)


class DoclingParser(BaseParser):
    """
    Docling-first parser wrapper.

    For Step 1, this keeps behavior safe and predictable:
    - try Docling when available
    - fallback to simple parser for guaranteed output
    """

    parser_name = "docling"

    def __init__(self) -> None:
        self._fallback = FallbackParser()

    def parse(
        self,
        path: Path,
        mime_type: str,
        *,
        document_id: UUID | None = None,
    ) -> ParsedDocument:
        parsed = self._try_docling_parse(path=path, mime_type=mime_type, document_id=document_id)
        if parsed is not None and parsed.blocks:
            return parsed
        fallback = self._fallback.parse(path, mime_type, document_id=document_id)
        fallback.metadata["fallback_reason"] = "docling_unavailable_or_empty"
        return fallback

    def _try_docling_parse(
        self,
        *,
        path: Path,
        mime_type: str,
        document_id: UUID | None,
    ) -> ParsedDocument | None:
        try:
            from docling.document_converter import DocumentConverter  # type: ignore
        except Exception:
            logger.info("Docling is not installed; using fallback parser")
            return None

        _ = mime_type  # reserved for parser routing later
        try:
            converter = DocumentConverter()
            result = converter.convert(str(path))
            doc = getattr(result, "document", None)
            if doc is None:
                return None

            data = self._doc_to_dict(doc)
            blocks = self._blocks_from_dict(data)
            if not blocks:
                return None
            return ParsedDocument(
                parser_name=self.parser_name,
                document_id=document_id,
                blocks=normalize_blocks(blocks),
                metadata={"source": "docling", "raw_block_count": len(blocks)},
            )
        except Exception:
            logger.exception("Docling parse failed for %s", path.name)
            return None

    def _doc_to_dict(self, doc: object) -> dict:
        # Docling version APIs can vary. Try common export methods.
        for attr in ("export_to_dict", "model_dump", "dict"):
            fn = getattr(doc, attr, None)
            if callable(fn):
                data = fn()
                if isinstance(data, dict):
                    return data
        return {}

    def _blocks_from_dict(self, data: dict) -> list[DocumentBlock]:
        items = list(self._walk_nodes(data))
        if not items:
            return []

        page_counters: dict[tuple[int, str], int] = {}
        blocks: list[DocumentBlock] = []

        for node in items:
            block_type = self._infer_block_type(node)
            text = self._node_text(node)
            page = self._node_page(node)
            key = (page, block_type)
            page_counters[key] = page_counters.get(key, 0) + 1

            table_data = None
            if block_type == "table":
                table_data = self._node_table_data(node)
                if not text and table_data:
                    text = str(table_data)[:2000]

            if block_type == "text" and not text:
                continue
            if block_type != "text" and not text and table_data is None:
                continue

            blocks.append(
                DocumentBlock(
                    block_id=build_block_id(page=page, block_type=block_type, index_on_page=page_counters[key]),
                    page=page,
                    block_type=block_type,
                    text=text,
                    table_data=table_data,
                    metadata={"source": "docling"},
                )
            )
        return blocks

    def _walk_nodes(self, data: dict):
        stack = [data]
        while stack:
            node = stack.pop()
            if not isinstance(node, dict):
                continue
            yield node
            kids = node.get("children") or node.get("kids") or []
            if isinstance(kids, list):
                for child in reversed(kids):
                    if isinstance(child, dict):
                        stack.append(child)

    def _infer_block_type(self, node: dict) -> str:
        raw = str(node.get("type") or node.get("label") or "").lower()
        if any(k in raw for k in ("table", "grid", "tabular")):
            return "table"
        if any(k in raw for k in ("figure", "image", "picture", "chart", "diagram")):
            return "image"
        return "text"

    def _node_text(self, node: dict) -> str:
        for key in ("text", "content", "value", "caption"):
            value = node.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    def _node_page(self, node: dict) -> int:
        for key in ("page_no", "page", "page_number", "pageNumber"):
            value = node.get(key)
            if isinstance(value, int) and value > 0:
                return value
            if isinstance(value, str) and value.isdigit() and int(value) > 0:
                return int(value)
        return 1

    def _node_table_data(self, node: dict) -> dict | None:
        table = node.get("table") or node.get("data")
        if isinstance(table, dict):
            return table
        if isinstance(table, list):
            return {"rows": table}
        return None
