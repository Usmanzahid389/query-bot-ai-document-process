from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

BlockType = Literal["text", "table", "image"]


class DocumentBlock(BaseModel):
    block_id: str = Field(description="Stable identifier for a block inside one document")
    page: int = Field(ge=1, description="1-based page index")
    block_type: BlockType
    text: str = Field(default="", description="Primary text content for retrieval")
    section_title: str | None = None
    table_data: dict | None = Field(default=None, description="Structured table content when block_type=table")
    image_path: str | None = Field(default=None, description="Optional extracted image path when block_type=image")
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class ParsedDocument(BaseModel):
    parser_name: str
    document_id: UUID | None = None
    blocks: list[DocumentBlock] = Field(default_factory=list)
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class DocumentBlockOut(BaseModel):
    """API shape for a persisted document_blocks row."""

    id: UUID
    parser_block_id: str
    position: int
    page: int
    block_type: str
    text: str
    section_title: str | None = None
    table_data: dict[str, Any] | list[Any] | None = None
    image_path: str | None = None
    metadata: dict[str, Any] | None = None


class DocumentBlocksListResponse(BaseModel):
    document_id: UUID
    total: int
    limit: int
    offset: int
    blocks: list[DocumentBlockOut]


class ChunkPreviewItem(BaseModel):
    chunk_index: int
    page: int
    block_type: str
    source_parser_block_id: str
    text: str


class ChunkPreviewResponse(BaseModel):
    document_id: UUID
    total_blocks: int
    blocks_used: int
    blocks_truncated: bool
    total_chunks: int
    returned: int
    chunks: list[ChunkPreviewItem]
