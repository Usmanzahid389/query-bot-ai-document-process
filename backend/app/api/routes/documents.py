import asyncio
import json
import logging
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.document import Document
from app.models.document_block import DocumentBlock
from app.models.user import User
from app.schemas.chat import SummaryResponse
from app.schemas.document import DocumentOut, ReindexQueuedResponse
from app.schemas.document_blocks import (
    ChunkPreviewItem,
    ChunkPreviewResponse,
    DocumentBlockOut,
    DocumentBlocksListResponse,
)
from app.services.document_parser import convert_to_pdf, extract_text_from_file
from app.services.parsers import DoclingParser
from app.services.parsers.fallback_parser import FallbackParser
from app.services import ai_service
from app.services.chunking import block_rows_to_inputs, build_retrieval_chunks
from app.services.rag import delete_document_vectors, index_document_vectors_task, reindex_all_documents_for_user
from app.services.rag.qa import summarize_document as rag_summarize_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXT = {".pdf", ".txt", ".docx"}
_EXT_MIME = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_docling_parser = DoclingParser()


async def _require_document(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def _orm_block_to_out(row: DocumentBlock) -> DocumentBlockOut:
    return DocumentBlockOut(
        id=row.id,
        parser_block_id=row.parser_block_id,
        position=row.position,
        page=row.page,
        block_type=row.block_type,
        text=row.text or "",
        section_title=row.section_title,
        table_data=row.table_data,
        image_path=row.image_path,
        metadata=row.extra_metadata,
    )


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


def _blocks_to_extracted_text(parsed) -> str:
    """
    Denormalized full text for previews/search; primary content lives in document_blocks rows.
    """
    parts: list[str] = []
    for block in parsed.blocks:
        if block.text:
            parts.append(block.text)
            continue
        if block.table_data:
            try:
                parts.append(json.dumps(block.table_data, ensure_ascii=False))
            except (TypeError, ValueError):
                parts.append(str(block.table_data))
    return "\n\n".join(parts).strip()


def _blocks_for_persist(parsed, path: Path, mime: str, doc_id: uuid.UUID):
    """Return schema blocks to store; use page parser if Docling produced no rows but text exists."""
    if parsed.blocks:
        return parsed.blocks
    fb = FallbackParser()
    reparsed = fb.parse(path, mime, document_id=doc_id)
    return reparsed.blocks


def _persist_blocks(
    db: AsyncSession,
    document_id: uuid.UUID,
    blocks,
) -> None:
    for position, block in enumerate(blocks):
        pid = (block.block_id or f"auto-{position}")[:128]
        meta = dict(block.metadata) if block.metadata else None
        db.add(
            DocumentBlock(
                document_id=document_id,
                parser_block_id=pid,
                position=position,
                page=int(block.page),
                block_type=block.block_type,
                text=block.text or "",
                section_title=block.section_title,
                table_data=block.table_data,
                image_path=block.image_path,
                extra_metadata=meta,
            )
        )


def _block_type_counts(parsed) -> dict[str, int]:
    counts = {"text": 0, "table": 0, "image": 0}
    for block in parsed.blocks:
        if block.block_type in counts:
            counts[block.block_type] += 1
    return counts


def _convert_docx_preview_task(path: Path) -> None:
    previews_dir = settings.upload_dir.parent / "previews"
    convert_to_pdf(path, previews_dir)


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
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
        parsed = await asyncio.to_thread(
            _docling_parser.parse,
            path,
            mime,
            document_id=doc_id,
        )
        extracted = _blocks_to_extracted_text(parsed)
        if not extracted:
            extracted = extract_text_from_file(path, mime)
        blocks_to_save = _blocks_for_persist(parsed, path, mime, doc_id)
    except ValueError as e:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        path.unlink(missing_ok=True)
        logger.exception("document parsing failed")
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
    await db.flush()
    _persist_blocks(db, doc_id, blocks_to_save)
    await db.commit()
    await db.refresh(doc)

    blk_res = await db.execute(
        select(DocumentBlock)
        .where(DocumentBlock.document_id == doc.id)
        .order_by(DocumentBlock.position.asc())
    )
    background_tasks.add_task(
        index_document_vectors_task,
        current.id,
        doc.id,
        block_rows_to_inputs(blk_res.scalars().all()),
        original_name,
    )

    if suffix == ".docx":
        background_tasks.add_task(_convert_docx_preview_task, path)

    return _document_to_out(doc)


@router.post("/reindex", response_model=ReindexQueuedResponse)
async def queue_reindex_all_documents(
    background_tasks: BackgroundTasks,
    current: Annotated[User, Depends(get_current_user)],
) -> ReindexQueuedResponse:
    background_tasks.add_task(reindex_all_documents_for_user, current.id)
    return ReindexQueuedResponse()


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


@router.get("/{document_id}/preview")
async def get_document_preview(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    original_path = Path(doc.stored_path)
    if not original_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")

    # Native PDFs can be previewed directly without conversion.
    if doc.mime_type == "application/pdf" or original_path.suffix.lower() == ".pdf":
        return FileResponse(
            path=original_path,
            media_type="application/pdf",
            filename=doc.original_filename,
            content_disposition_type="inline",
        )

    previews_dir = settings.upload_dir.parent / "previews"
    preview_path = previews_dir / f"{original_path.stem}.pdf"
    if not preview_path.is_file():
        raise HTTPException(status_code=404, detail="Preview not found")

    preview_name = f"{Path(doc.original_filename).stem}.pdf"
    return FileResponse(
        path=preview_path,
        media_type="application/pdf",
        filename=preview_name,
        content_disposition_type="inline",
    )


@router.get("/{document_id}/blocks", response_model=DocumentBlocksListResponse)
async def list_document_blocks(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(200, ge=1, le=500, description="Page size (max 500)"),
    offset: int = Query(0, ge=0),
) -> DocumentBlocksListResponse:
    await _require_document(db, user_id=current.id, document_id=document_id)
    total = await db.scalar(
        select(func.count()).select_from(DocumentBlock).where(DocumentBlock.document_id == document_id)
    )
    total_i = int(total or 0)
    result = await db.execute(
        select(DocumentBlock)
        .where(DocumentBlock.document_id == document_id)
        .order_by(DocumentBlock.position.asc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()
    return DocumentBlocksListResponse(
        document_id=document_id,
        total=total_i,
        limit=limit,
        offset=offset,
        blocks=[_orm_block_to_out(r) for r in rows],
    )


@router.get("/{document_id}/chunks-preview", response_model=ChunkPreviewResponse)
async def preview_document_chunks(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    chunk_limit: int = Query(80, ge=1, le=200, description="Max chunks to return"),
    max_blocks: int = Query(
        4000,
        ge=1,
        le=8000,
        description="Max blocks to read from DB when building chunks (safety cap)",
    ),
) -> ChunkPreviewResponse:
    await _require_document(db, user_id=current.id, document_id=document_id)
    total_blocks = int(
        await db.scalar(
            select(func.count()).select_from(DocumentBlock).where(DocumentBlock.document_id == document_id)
        )
        or 0
    )
    read_n = min(max_blocks, total_blocks)
    if read_n == 0:
        return ChunkPreviewResponse(
            document_id=document_id,
            total_blocks=total_blocks,
            blocks_used=0,
            blocks_truncated=False,
            total_chunks=0,
            returned=0,
            chunks=[],
        )
    result = await db.execute(
        select(DocumentBlock)
        .where(DocumentBlock.document_id == document_id)
        .order_by(DocumentBlock.position.asc())
        .limit(read_n)
    )
    rows = result.scalars().all()
    inputs = block_rows_to_inputs(rows)
    all_chunks = build_retrieval_chunks(inputs)
    slice_chunks = all_chunks[:chunk_limit]
    return ChunkPreviewResponse(
        document_id=document_id,
        total_blocks=total_blocks,
        blocks_used=len(rows),
        blocks_truncated=total_blocks > read_n,
        total_chunks=len(all_chunks),
        returned=len(slice_chunks),
        chunks=[
            ChunkPreviewItem(
                chunk_index=c[0],
                page=c[1],
                block_type=c[2],
                source_parser_block_id=c[3],
                text=c[4],
            )
            for c in slice_chunks
        ],
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


@router.get("/{document_id}/parse-debug")
async def parse_debug(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Dev helper: re-run parser on stored file and return block diagnostics.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    path = Path(doc.stored_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")

    parsed = await asyncio.to_thread(
        _docling_parser.parse,
        path,
        doc.mime_type,
        document_id=doc.id,
    )
    counts = _block_type_counts(parsed)
    samples = [
        {
            "block_id": b.block_id,
            "page": b.page,
            "block_type": b.block_type,
            "text_preview": (b.text or "")[:180],
        }
        for b in parsed.blocks[:8]
    ]
    return {
        "document_id": str(doc.id),
        "parser_name": parsed.parser_name,
        "total_blocks": len(parsed.blocks),
        "counts": counts,
        "metadata": parsed.metadata,
        "samples": samples,
    }


@router.get("/{document_id}/search")
async def search_in_document_text(
    document_id: uuid.UUID,
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(..., min_length=1, description="Case-insensitive keyword to find in extracted text"),
) -> dict:
    """
    Debug helper: confirm whether a keyword exists in stored extracted_text.
    Returns small context snippets around matches.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == current.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    text = (doc.extracted_text or "").replace("\x00", "")
    needle = q.strip()
    if not needle:
        raise HTTPException(status_code=400, detail="q must not be empty")

    lower_text = text.lower()
    lower_needle = needle.lower()
    matches: list[int] = []
    pos = 0
    while True:
        idx = lower_text.find(lower_needle, pos)
        if idx == -1:
            break
        matches.append(idx)
        pos = idx + max(len(lower_needle), 1)
        if len(matches) >= 20:
            break

    snippets: list[str] = []
    for idx in matches[:5]:
        start = max(0, idx - 120)
        end = min(len(text), idx + len(needle) + 120)
        snippets.append(text[start:end].replace("\n", " ").strip())

    return {
        "document_id": str(doc.id),
        "query": needle,
        "found": bool(matches),
        "match_count": len(matches),
        "snippets": snippets,
    }


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
    delete_document_vectors(document_id)
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
    if settings.rag_enabled and (settings.llm_api_key or "").strip():
        try:
            summary = await asyncio.to_thread(
                rag_summarize_document,
                current.id,
                doc.id,
                doc.original_filename,
            )
        except Exception:
            logger.exception("RAG summary failed; using mock summary")
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
    return SummaryResponse(document_id=doc.id, summary=summary)


