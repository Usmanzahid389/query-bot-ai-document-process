from __future__ import annotations

from collections.abc import Sequence

from app.models.document_block import DocumentBlock
from app.services.chunking.text_chunker import BlockInput


def block_rows_to_inputs(rows: Sequence[DocumentBlock]) -> list[BlockInput]:
    """Single place to map ORM rows → chunker input tuples (avoids duplication across routes/RAG)."""
    return [(r.text or "", r.page, r.block_type, r.parser_block_id, r.table_data) for r in rows]
