from __future__ import annotations

import re

from app.schemas.document_blocks import DocumentBlock

_WS_RE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    cleaned = (text or "").replace("\x00", " ")
    cleaned = _WS_RE.sub(" ", cleaned).strip()
    return cleaned


def build_block_id(*, page: int, block_type: str, index_on_page: int) -> str:
    return f"p{page}-{block_type}-{index_on_page}"


def normalize_blocks(blocks: list[DocumentBlock]) -> list[DocumentBlock]:
    """
    Keep output deterministic and retrieval-friendly:
    - trim/normalize whitespace
    - drop empty text blocks
    - stable sort by page then block id
    """
    normalized: list[DocumentBlock] = []
    for block in blocks:
        block.text = normalize_text(block.text)
        if block.block_type == "text" and not block.text:
            continue
        normalized.append(block)

    normalized.sort(key=lambda b: (b.page, b.block_id))
    return normalized
