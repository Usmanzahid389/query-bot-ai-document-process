from __future__ import annotations

import logging
import uuid
from collections.abc import Sequence

from app.core.config import settings
from app.services.chunking.text_chunker import BlockInput, build_retrieval_chunks
from app.services.rag.chroma_store import delete_document_vectors, upsert_document_chunks

logger = logging.getLogger(__name__)


def index_document_vectors(
    user_id: uuid.UUID,
    document_id: uuid.UUID,
    inputs: Sequence[BlockInput],
    source_filename: str,
) -> int:
    """
    Replace vectors for one document. Safe to call after upload or reindex.
    Returns number of chunks indexed.
    """
    if not settings.rag_enabled:
        return 0
    delete_document_vectors(document_id)
    chunks = build_retrieval_chunks(
        list(inputs),
        max_chunk_chars=settings.rag_max_chunk_chars,
        overlap=settings.rag_chunk_overlap,
    )
    if not chunks:
        return 0
    try:
        upsert_document_chunks(user_id, document_id, source_filename, chunks)
    except Exception:
        logger.exception("Chroma upsert failed for document_id=%s", document_id)
        raise
    return len(chunks)


def index_document_vectors_task(
    user_id: uuid.UUID,
    document_id: uuid.UUID,
    inputs: list[BlockInput],
    source_filename: str,
) -> None:
    """BackgroundTasks entrypoint (sync)."""
    try:
        n = index_document_vectors(user_id, document_id, inputs, source_filename)
        logger.info("RAG index done document_id=%s chunks=%s", document_id, n)
    except Exception:
        logger.exception("RAG index task failed document_id=%s", document_id)
