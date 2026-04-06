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

    # RAG: Chroma + Hugging Face embeddings + Ollama LLM
    chroma_dir: Path = Path(__file__).resolve().parent.parent.parent / "chroma_db"
    chroma_collection: str = "querybot_documents"
    embedding_model_id: str = "sentence-transformers/all-MiniLM-L6-v2"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2"
    ollama_timeout_seconds: float = 180.0
    rag_chunk_size: int = 900
    rag_chunk_overlap: int = 120
    rag_top_k: int = 6
    rag_summary_top_k: int = 12


settings = Settings()
