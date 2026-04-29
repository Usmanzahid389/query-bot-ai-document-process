from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./querybot.db"
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    upload_dir: Path = Path(__file__).resolve().parent.parent.parent / "uploads"
    max_upload_bytes: int = 10 * 1024 * 1024

    # PDF: auto | hybrid | opendataloader (OpenDataLoader first, PyMuPDF merge if incomplete) | pymupdf (plain only)
    pdf_parser: str = "auto"

    # RAG (Chroma + sentence-transformers + OpenAI-compatible chat)
    rag_enabled: bool = True
    chroma_dir: Path = Path(__file__).resolve().parent.parent.parent / "chroma_db"
    chroma_collection: str = "querybot_documents"
    embedding_model_id: str = "BAAI/bge-base-en-v1.5"
    # Env: RAG_MAX_CHUNK_CHARS, RAG_CHUNK_OVERLAP, RAG_TOP_K (pydantic-settings maps these)
    rag_max_chunk_chars: int = 1000
    rag_chunk_overlap: int = 250
    rag_top_k: int = 25
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    llm_timeout_seconds: float = 120.0


settings = Settings()
