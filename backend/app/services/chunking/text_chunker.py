from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

# One tuple per DB/parser block: (text, page, block_type, parser_block_id, table_data)
BlockInput = tuple[str, int, str, str, Any]

# (chunk_index, page, block_type, parser_block_id, text)
ChunkTuple = tuple[int, int, str, str, str]


def _plain_content(text: str, block_type: str, table_data: Any) -> str:
    if block_type == "table" and table_data is not None:
        try:
            return json.dumps(table_data, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(table_data)
    return (text or "").strip()


def _split_chunks(text: str, max_chars: int, overlap: int) -> list[str]:
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    out: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + max_chars, n)
        out.append(text[start:end])
        if end >= n:
            break
        start = max(0, end - overlap)
    return out


def build_retrieval_chunks(
    blocks: Sequence[BlockInput],
    *,
    max_chunk_chars: int = 1200,
    overlap: int = 120,
) -> list[ChunkTuple]:
    """
    Turn ordered blocks into overlapping text chunks for embedding/RAG.
    No DB or framework dependencies — safe to call from API or workers.
    """
    chunks: list[ChunkTuple] = []
    idx = 0
    for text, page, block_type, parser_block_id, table_data in blocks:
        content = _plain_content(text, block_type, table_data)
        if not content:
            continue
        for piece in _split_chunks(content, max_chunk_chars, overlap):
            chunks.append((idx, page, block_type, parser_block_id, piece))
            idx += 1
    return chunks
