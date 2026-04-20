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

    # PDF: auto | hybrid | opendataloader (OpenDataLoader first, PyMuPDF merge if incomplete) | pymupdf (plain only)
    pdf_parser: str = "auto"

    # RAG: Chroma + Hugging Face embeddings + OpenAI-compatible LLM (OpenRouter, Groq, etc.)
    chroma_dir: Path = Path(__file__).resolve().parent.parent.parent / "chroma_db"
    chroma_collection: str = "querybot_documents"
    embedding_model_id: str = "sentence-transformers/all-MiniLM-L6-v2"
    # Embedding prefixes for retrieval-tuned models (for example BGE).
    # If left empty and EMBEDDING_AUTO_PREFIX_BGE=true, BGE models get sensible defaults.
    embedding_query_prefix: str = ""
    embedding_document_prefix: str = ""
    embedding_auto_prefix_bge: bool = True
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "llama-3.3-70b-versatile"
    llm_api_key: str = ""
    llm_timeout_seconds: float = 180.0
    # Chunking: RecursiveCharacterTextSplitter — larger chunks + overlap reduce fragmentation on dense pages.
    rag_chunk_size: int = 1000
    rag_chunk_overlap: int = 200
    # Q&A retrieval: more chunks = broader context for diagrams / spread-out lists.
    rag_qa_top_k: int = 7
    # When the user asks about a specific PDF page, retrieve up to this many chunks from that page.
    rag_page_retrieval_k: int = 80
    # Q&A retrieval: similarity top-k keeps adjacent chunks from the same section (better for “list all requirements”).
    # Summaries still use MMR when rag_mmr_enabled (below).
    rag_qa_use_mmr: bool = False
    rag_fetch_k: int = 56
    rag_top_k: int = 22
    rag_mmr_enabled: bool = True
    # 1.0 ≈ pure relevance; used for summary retrieval when MMR is on.
    rag_mmr_lambda: float = 0.82
    rag_summary_fetch_k: int | None = None  # None → use rag_fetch_k
    rag_summary_top_k: int = 12

    @model_validator(mode="after")
    def _rag_k_bounds(self) -> "Settings":
        qa_k = int(self.rag_qa_top_k)
        if qa_k < 1:
            qa_k = 1
        object.__setattr__(self, "rag_qa_top_k", qa_k)
        page_k = int(self.rag_page_retrieval_k)
        if page_k < qa_k:
            page_k = qa_k
        object.__setattr__(self, "rag_page_retrieval_k", page_k)
        min_fetch = max(int(self.rag_top_k), qa_k, int(self.rag_summary_top_k))
        if self.rag_fetch_k < min_fetch:
            object.__setattr__(self, "rag_fetch_k", min_fetch)
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
