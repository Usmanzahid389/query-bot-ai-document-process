from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    text_preview: str = Field(description="First ~500 chars of extracted text")
    created_at: datetime

    model_config = {"from_attributes": True}
