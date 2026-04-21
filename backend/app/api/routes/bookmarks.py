import uuid
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.bookmark import Bookmark
from app.models.chat import ChatSession, ChatSessionDocument, Message
from app.models.document import Document
from app.models.user import User
from app.schemas.bookmark import BookmarkCreate, BookmarkOut

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


async def _resolve_bookmark_context(
    db: AsyncSession, bookmark: Bookmark
) -> tuple[Message, ChatSession, list[uuid.UUID], list[str]]:
    result = await db.execute(
        select(Message, ChatSession)
        .join(ChatSession, ChatSession.id == Message.session_id)
        .where(Message.id == bookmark.message_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Bookmark message no longer exists")
    message, session = row

    docs_result = await db.execute(
        select(Document.id, Document.original_filename)
        .join(ChatSessionDocument, ChatSessionDocument.document_id == Document.id)
        .where(ChatSessionDocument.session_id == session.id)
        .order_by(Document.created_at.asc())
    )
    doc_rows = docs_result.all()
    document_ids = [doc_id for doc_id, _ in doc_rows]
    document_names = [name for _, name in doc_rows]
    return message, session, document_ids, document_names


@router.post("", response_model=BookmarkOut, status_code=status.HTTP_201_CREATED)
async def create_bookmark(
    body: BookmarkCreate,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BookmarkOut:
    result = await db.execute(
        select(Message, ChatSession)
        .join(ChatSession, ChatSession.id == Message.session_id)
        .where(Message.id == body.message_id, ChatSession.user_id == current.id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Message not found")
    message, session = row

    existing_result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == current.id, Bookmark.message_id == body.message_id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        bookmark = existing
    else:
        bookmark = Bookmark(
            user_id=current.id,
            message_id=message.id,
            snippet=(message.content or "")[:4000],
        )
        db.add(bookmark)
        await db.commit()
        await db.refresh(bookmark)

    _, _, document_ids, document_names = await _resolve_bookmark_context(db, bookmark)
    return BookmarkOut(
        id=bookmark.id,
        message_id=bookmark.message_id,
        session_id=session.id,
        session_title=session.title,
        document_ids=document_ids,
        document_names=document_names,
        snippet=bookmark.snippet,
        created_at=bookmark.created_at,
    )


@router.get("", response_model=list[BookmarkOut])
async def list_bookmarks(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, ge=1, le=500),
) -> list[BookmarkOut]:
    result = await db.execute(
        select(Bookmark, Message, ChatSession)
        .join(Message, Message.id == Bookmark.message_id)
        .join(ChatSession, ChatSession.id == Message.session_id)
        .where(Bookmark.user_id == current.id, ChatSession.user_id == current.id)
        .order_by(Bookmark.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    if not rows:
        return []

    session_ids = sorted({session.id for _, _, session in rows}, key=lambda v: str(v))
    docs_result = await db.execute(
        select(ChatSessionDocument.session_id, Document.id, Document.original_filename)
        .join(Document, Document.id == ChatSessionDocument.document_id)
        .where(ChatSessionDocument.session_id.in_(session_ids))
        .order_by(Document.created_at.asc())
    )
    session_docs: dict[uuid.UUID, list[tuple[uuid.UUID, str]]] = defaultdict(list)
    for sid, doc_id, name in docs_result.all():
        session_docs[sid].append((doc_id, name))

    out: list[BookmarkOut] = []
    for bookmark, _, session in rows:
        docs = session_docs.get(session.id, [])
        out.append(
            BookmarkOut(
                id=bookmark.id,
                message_id=bookmark.message_id,
                session_id=session.id,
                session_title=session.title,
                document_ids=[doc_id for doc_id, _ in docs],
                document_names=[name for _, name in docs],
                snippet=bookmark.snippet,
                created_at=bookmark.created_at,
            )
        )
    return out


@router.get("/message-ids", response_model=list[uuid.UUID])
async def list_bookmarked_message_ids(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    session_id: uuid.UUID | None = Query(default=None),
) -> list[uuid.UUID]:
    q = (
        select(Bookmark.message_id)
        .join(Message, Message.id == Bookmark.message_id)
        .join(ChatSession, ChatSession.id == Message.session_id)
        .where(Bookmark.user_id == current.id, ChatSession.user_id == current.id)
    )
    if session_id is not None:
        q = q.where(ChatSession.id == session_id)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark(
    bookmark_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current.id)
    )
    bookmark = result.scalar_one_or_none()
    if bookmark is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    await db.delete(bookmark)
    await db.commit()


@router.delete("/by-message/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark_by_message(
    message_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        delete(Bookmark)
        .where(Bookmark.user_id == current.id, Bookmark.message_id == message_id)
        .returning(Bookmark.id)
    )
    deleted = result.first()
    if deleted is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    await db.commit()
