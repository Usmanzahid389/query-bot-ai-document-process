from __future__ import annotations

import logging
import uuid

import app.models  # noqa: F401 — register mappers before sync Session
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import Document
from app.models.document_block import DocumentBlock
from app.services.chunking.block_inputs import block_rows_to_inputs
from app.services.rag.indexing import index_document_vectors

logger = logging.getLogger(__name__)


def _sync_database_url() -> str:
    return settings.database_url.replace("sqlite+aiosqlite", "sqlite", 1)


def reindex_all_documents_for_user(user_id: uuid.UUID) -> None:
    """Sync job for BackgroundTasks: rebuild vectors for every document owned by user."""
    if not settings.rag_enabled:
        logger.info("RAG disabled; skip reindex")
        return
    url = _sync_database_url()
    engine = create_engine(url)
    with Session(engine) as session:
        docs = session.execute(select(Document).where(Document.user_id == user_id)).scalars().all()
        for doc in docs:
            rows = (
                session.execute(
                    select(DocumentBlock)
                    .where(DocumentBlock.document_id == doc.id)
                    .order_by(DocumentBlock.position.asc())
                )
                .scalars()
                .all()
            )
            inputs = block_rows_to_inputs(rows)
            try:
                n = index_document_vectors(user_id, doc.id, inputs, doc.original_filename)
                logger.info("Reindexed document_id=%s chunks=%s", doc.id, n)
            except Exception:
                logger.exception("Reindex failed for document_id=%s", doc.id)
