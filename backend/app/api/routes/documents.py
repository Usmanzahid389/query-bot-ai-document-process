import asyncio
import logging
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.chat import SummaryResponse
from app.schemas.document import DocumentOut
from app.services.document_parser import extract_pages_from_file, extract_text_from_file
from app.services import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXT = {".pdf", ".txt", ".docx"}
_EXT_MIME = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _safe_preview(text: str, limit: int = 500) -> str:
    raw = (text or "")[:limit]
    if len(text or "") > limit:
        raw += "…"
    return raw.encode("utf-8", errors="replace").decode("utf-8")


def _document_to_out(d: Document) -> DocumentOut:
    preview = _safe_preview(d.extracted_text or "", 500)
    return DocumentOut(
        id=d.id,
        original_filename=d.original_filename,
        mime_type=d.mime_type,
        size_bytes=d.size_bytes,
        text_preview=preview,
        created_at=d.created_at,
    )


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> DocumentOut:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required")
    suffix = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
    if suffix not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed extensions: {', '.join(sorted(ALLOWED_EXT))}",
        )

    raw = await file.read()
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_upload_bytes // (1024 * 1024)} MB.",
        )

    mime = _EXT_MIME[suffix]
    doc_id = uuid.uuid4()
    safe_name = f"{doc_id}{suffix}"
    path = settings.upload_dir / safe_name
    path.write_bytes(raw)

    original_name = (file.filename or "file")[:512]

    try:
        extracted = extract_text_from_file(path, mime)
    except ValueError as e:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        path.unlink(missing_ok=True)
        logger.exception("extract_text_from_file failed")
        raise HTTPException(
            status_code=400,
            detail="Could not read this file. Try another PDF/DOCX/TXT or check if the PDF is corrupted or image-only.",
        ) from e

    doc = Document(
        id=doc_id,
        user_id=current.id,
        original_filename=original_name,
        stored_path=str(path),
        mime_type=mime,
        size_bytes=len(raw),
        extracted_text=extracted,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    try:
        pages = extract_pages_from_file(path, mime)
        await asyncio.to_thread(
            rag_service.index_document,
            current.id,
            doc.id,
            doc.original_filename,
            pages,
        )
    except Exception:
        logger.exception(
            "RAG indexing failed for document %s; will retry on first query",
            doc.id,
        )

    return _document_to_out(doc)


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DocumentOut]:
    result = await db.execute(
        select(Document).where(Document.user_id == current.id).order_by(Document.created_at.desc())
    )
    rows = result.scalars().all()
    return [_document_to_out(d) for d in rows]


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    """Return the stored upload for preview/download (same user only)."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(doc.stored_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")
    return FileResponse(
        path=path,
        media_type=doc.mime_type,
        filename=doc.original_filename,
        content_disposition_type="inline",
    )


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentOut:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return _document_to_out(doc)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    await asyncio.to_thread(rag_service.delete_document_index, document_id)
    Path(doc.stored_path).unlink(missing_ok=True)
    await db.delete(doc)
    await db.commit()


@router.post("/{document_id}/summary", response_model=SummaryResponse)
async def summarize_document(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SummaryResponse:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    summary = await asyncio.to_thread(
        rag_service.summarize_document_rag,
        current.id,
        doc.id,
        doc.original_filename,
        doc.extracted_text or "",
    )
    return SummaryResponse(document_id=doc.id, summary=summary)
