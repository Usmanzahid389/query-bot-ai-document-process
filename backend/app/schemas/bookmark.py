from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _ensure_utc_dt(v: Any) -> Any:
    if isinstance(v, datetime) and v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v


class BookmarkCreate(BaseModel):
    message_id: UUID


class BookmarkOut(BaseModel):
    id: UUID
    message_id: UUID
    session_id: UUID
    session_title: str
    document_ids: list[UUID] = Field(default_factory=list)
    document_names: list[str] = Field(default_factory=list)
    snippet: str
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def created_at_utc(cls, v: Any) -> Any:
        return _ensure_utc_dt(v)
