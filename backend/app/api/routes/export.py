import asyncio
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.chat import ChatSession, Message
from app.models.document import Document
from app.models.user import User
from app.services import ai_service
from app.services.export_render import render_docx, render_pdf
from app.services.rag.qa import summarize_document as rag_summarize_document

router = APIRouter(prefix="/export", tags=["export"])
logger = logging.getLogger(__name__)


@router.get("/chat/{session_id}")
async def export_chat(
    session_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = Query("pdf", description="pdf or docx"),
) -> Response:
    fmt = format.lower()
    if fmt not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="format must be pdf or docx")

    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id, ChatSession.user_id == current.id)
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = sorted(session.messages, key=lambda m: m.created_at)
    lines: list[str] = []
    for m in messages:
        role = "User" if m.role == "user" else "Assistant"
        lines.append(f"{role}: {m.content}")

    title = f"QueryBot chat — {session.title}"
    if fmt == "pdf":
        body = render_pdf(title, lines)
        media = "application/pdf"
        filename = f"chat-{session_id}.pdf"
    else:
        body = render_docx(title, lines)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"chat-{session_id}.docx"

    return Response(
        content=body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/summary/{document_id}")
async def export_summary(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = Query("pdf", description="pdf or docx"),
) -> Response:
    fmt = format.lower()
    if fmt not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="format must be pdf or docx")

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if settings.rag_enabled and (settings.llm_api_key or "").strip():
        try:
            summary = await asyncio.to_thread(
                rag_summarize_document,
                current.id,
                document_id,
                doc.original_filename,
            )
        except Exception:
            logger.exception("RAG summary export failed; mock fallback")
            summary = await asyncio.to_thread(
                ai_service.mock_summary,
                doc.original_filename,
                doc.extracted_text or "",
            )
    else:
        summary = await asyncio.to_thread(
            ai_service.mock_summary,
            doc.original_filename,
            doc.extracted_text or "",
        )
    title = f"Summary — {doc.original_filename}"
    paras = [p.strip() for p in summary.split("\n\n") if p.strip()]
    if fmt == "pdf":
        body = render_pdf(title, paras)
        media = "application/pdf"
        filename = f"summary-{document_id}.pdf"
    else:
        body = render_docx(title, paras)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"summary-{document_id}.docx"

    return Response(
        content=body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
