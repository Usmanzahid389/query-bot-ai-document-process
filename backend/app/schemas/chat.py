from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _ensure_utc_dt(v: Any) -> Any:
    if isinstance(v, datetime) and v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v


class ChatSessionCreate(BaseModel):
    document_ids: list[UUID] = Field(min_length=1)
    title: str | None = None


class ChatMessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("created_at", mode="before")
    @classmethod
    def created_at_utc(cls, v: Any) -> Any:
        return _ensure_utc_dt(v)


class ChatSessionOut(BaseModel):
    id: UUID
    title: str
    document_ids: list[UUID]
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("created_at", mode="before")
    @classmethod
    def created_at_utc(cls, v: Any) -> Any:
        return _ensure_utc_dt(v)


class SendMessageRequest(BaseModel):
    session_id: UUID | None = None
    document_ids: list[UUID] = Field(min_length=1)
    message: str = Field(min_length=1, max_length=16000)


class SummaryResponse(BaseModel):
    document_id: UUID
    summary: str


class ChatCompareRequest(BaseModel):
    document_id_a: UUID
    document_id_b: UUID


class ChatCompareResponse(BaseModel):
    document_a_title: str
    document_b_title: str
    analysis: str


class ChatSendResponse(BaseModel):
    session_id: UUID
    user_message: ChatMessageOut
    assistant_message: ChatMessageOut
