from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from uuid import UUID

from app.schemas.document_blocks import ParsedDocument


class BaseParser(ABC):
    parser_name: str = "base"

    @abstractmethod
    def parse(
        self,
        path: Path,
        mime_type: str,
        *,
        document_id: UUID | None = None,
    ) -> ParsedDocument:
        """
        Parse a source file into normalized document blocks.
        """
        raise NotImplementedError
