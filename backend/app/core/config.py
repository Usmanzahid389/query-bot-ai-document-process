from pathlib import Path

from pydantic import model_validator
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

    # PDF text extraction: opendataloader (layout-aware, needs Java) | pymupdf | auto (try OpenDataLoader, then PyMuPDF)
    pdf_parser: str = "auto"

    # RAG: Chroma + Hugging Face embeddings + OpenAI-compatible LLM (OpenRouter, Groq, etc.)
    chroma_dir: Path = Path(__file__).resolve().parent.parent.parent / "chroma_db"
    chroma_collection: str = "querybot_documents"
    embedding_model_id: str = "sentence-transformers/all-MiniLM-L6-v2"
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    llm_api_key: str = ""
    llm_timeout_seconds: float = 180.0
    # Chunking: slightly smaller chunks + higher overlap help headings stay with the following list.
    rag_chunk_size: int = 800
    rag_chunk_overlap: int = 160
    # MMR: fetch many candidates from Chroma, then pick rag_top_k with diverse embeddings (no cross-encoder).
    rag_fetch_k: int = 28
    rag_top_k: int = 12
    rag_mmr_enabled: bool = True
    # 1.0 = most like plain top-k similarity; lower = more diversity between chunks.
    rag_mmr_lambda: float = 0.55
    rag_summary_fetch_k: int | None = None  # None → use rag_fetch_k
    rag_summary_top_k: int = 10

    @model_validator(mode="after")
    def _rag_k_bounds(self) -> "Settings":
        if self.rag_fetch_k < self.rag_top_k:
            object.__setattr__(self, "rag_fetch_k", self.rag_top_k)
        s_fetch = self.rag_summary_fetch_k
        if s_fetch is not None and s_fetch < self.rag_summary_top_k:
            object.__setattr__(self, "rag_summary_fetch_k", self.rag_summary_top_k)
        lam = float(self.rag_mmr_lambda)
        if lam < 0.0:
            lam = 0.0
        elif lam > 1.0:
            lam = 1.0
        object.__setattr__(self, "rag_mmr_lambda", lam)
        return self


settings = Settings()
