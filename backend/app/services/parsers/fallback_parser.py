from __future__ import annotations

from pathlib import Path
from uuid import UUID

from app.schemas.document_blocks import DocumentBlock, ParsedDocument
from app.services.document_parser import extract_pages_from_file
from app.services.parsers.base_parser import BaseParser
from app.services.parsers.normalize_blocks import build_block_id, normalize_blocks


class FallbackParser(BaseParser):
    """
    Minimal parser that converts each extracted page into one text block.
    Safe default while richer parsers are still being added.
    """

    parser_name = "fallback"

    def parse(
        self,
        path: Path,
        mime_type: str,
        *,
        document_id: UUID | None = None,
    ) -> ParsedDocument:
        pages = extract_pages_from_file(path, mime_type)
        blocks: list[DocumentBlock] = []
        for idx, (page_num, text) in enumerate(pages, start=1):
            blocks.append(
                DocumentBlock(
                    block_id=build_block_id(page=page_num, block_type="text", index_on_page=idx),
                    page=page_num,
                    block_type="text",
                    text=text,
                    metadata={"source": "fallback_page_text"},
                )
            )

        return ParsedDocument(
            parser_name=self.parser_name,
            document_id=document_id,
            blocks=normalize_blocks(blocks),
            metadata={"page_count": len(pages)},
        )
