import asyncio
import logging
import uuid
from types import SimpleNamespace
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.chat import ChatSession, ChatSessionDocument, Message
from app.models.document import Document
from app.models.user import User
from app.schemas.chat import (
    ChatMessageOut,
    ChatSendResponse,
    ChatSessionCreate,
    ChatSessionOut,
    SendMessageRequest,
)
from app.services import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_owned_documents(
    db: AsyncSession, user_id: uuid.UUID, doc_ids: list[uuid.UUID]
) -> list[Document]:
    if not doc_ids:
        return []
    result = await db.execute(
        select(Document).where(Document.user_id == user_id, Document.id.in_(doc_ids))
    )
    found = {d.id: d for d in result.scalars().all()}
    missing = set(doc_ids) - set(found.keys())
    if missing:
        raise HTTPException(status_code=404, detail=f"Document(s) not found: {missing}")
    return [found[i] for i in doc_ids]


def _session_doc_ids(session: ChatSession) -> list[uuid.UUID]:
    return sorted([link.document_id for link in session.document_links], key=lambda x: str(x))


@router.post("/sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: ChatSessionCreate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatSessionOut:
    docs = await _get_owned_documents(db, current.id, body.document_ids)
    title = body.title or f"Chat — {docs[0].original_filename}"
    session = ChatSession(user_id=current.id, title=title[:512])
    db.add(session)
    await db.flush()
    for d in docs:
        db.add(ChatSessionDocument(session_id=session.id, document_id=d.id))
    await db.commit()
    await db.refresh(session)
    return ChatSessionOut(
        id=session.id,
        title=session.title,
        document_ids=[d.id for d in docs],
        created_at=session.created_at,
    )


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    document_id: uuid.UUID | None = Query(None, description="Filter sessions that include this document"),
) -> list[ChatSessionOut]:
    q = (
        select(ChatSession)
        .where(ChatSession.user_id == current.id)
        .options(selectinload(ChatSession.document_links))
        .order_by(ChatSession.created_at.desc())
    )
    result = await db.execute(q)
    sessions = result.scalars().unique().all()
    out: list[ChatSessionOut] = []
    for s in sessions:
        ids = _session_doc_ids(s)
        if document_id is not None and document_id not in ids:
            continue
        out.append(
            ChatSessionOut(id=s.id, title=s.title, document_ids=ids, created_at=s.created_at)
        )
    return out


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_messages(
    session_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ChatMessageOut]:
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current.id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = msg_result.scalars().all()
    return [
        ChatMessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at)
        for m in messages
    ]


@router.post("/messages", response_model=ChatSendResponse)
async def send_message(
    body: SendMessageRequest,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatSendResponse:
    docs = await _get_owned_documents(db, current.id, body.document_ids)

    if body.session_id is None:
        title = f"Chat — {docs[0].original_filename}"
        session = ChatSession(user_id=current.id, title=title[:512])
        db.add(session)
        await db.flush()
        for d in docs:
            db.add(ChatSessionDocument(session_id=session.id, document_id=d.id))
    else:
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == body.session_id, ChatSession.user_id == current.id)
            .options(selectinload(ChatSession.document_links))
        )
        session = result.scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        existing = set(_session_doc_ids(session))
        if existing != set(body.document_ids):
            raise HTTPException(
                status_code=400,
                detail="document_ids must match the documents linked to this session",
            )

    user_msg = Message(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()

    # Snapshot plain data: SQLAlchemy ORM instances must not be used inside the worker
    # thread (greenlet / session bound to async context → 500 on attribute access).
    doc_snapshots = [
        SimpleNamespace(
            id=d.id,
            original_filename=d.original_filename,
            extracted_text=d.extracted_text or "",
        )
        for d in docs
    ]
    sources: list[dict[str, object]] = []
    try:
        rag_result = await asyncio.to_thread(
            rag_service.answer_question,
            current.id,
            doc_snapshots,
            body.message,
        )
    except Exception:
        logger.exception("RAG LLM call failed for chat message")
        answer = (
            "Could not get an AI reply. Check LLM_API_KEY, that LLM_MODEL is valid for your provider "
            f"(current: '{settings.llm_model}' at {settings.llm_base_url}), and the server can reach that URL. "
            "If you use Groq, model IDs look like 'llama-3.3-70b-versatile', not OpenRouter slugs. "
            "See the API terminal log for details."
        )
    else:
        if isinstance(rag_result, dict):
            answer = rag_result.get("answer", "")
            raw_sources = rag_result.get("sources", [])
            if isinstance(raw_sources, list):
                sources = [s for s in raw_sources if isinstance(s, dict)]
        else:
            answer = rag_result
    if not isinstance(answer, str):
        answer = str(answer) if answer is not None else ""
    answer = answer.replace("\x00", "")
    assistant_msg = Message(session_id=session.id, role="assistant", content=answer)
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return ChatSendResponse(
        session_id=session.id,
        user_message=ChatMessageOut(
            id=user_msg.id,
            role=user_msg.role,
            content=user_msg.content,
            created_at=user_msg.created_at,
        ),
        assistant_message=ChatMessageOut(
            id=assistant_msg.id,
            role=assistant_msg.role,
            content=assistant_msg.content,
            created_at=assistant_msg.created_at,
        ),
        assistant_sources=sources,
    )
