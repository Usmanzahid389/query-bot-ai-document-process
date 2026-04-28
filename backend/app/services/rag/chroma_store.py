from __future__ import annotations
import logging
import uuid
from functools import lru_cache
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from app.core.config import settings
from rank_bm25 import BM25Okapi  # Naya addition: Keyword search ke liye

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def _embedding_function() -> SentenceTransformerEmbeddingFunction:
    # Aapka "BAAI/bge-base-en-v1.5" model settings se yahan load ho raha hai
    return SentenceTransformerEmbeddingFunction(model_name=settings.embedding_model_id)

@lru_cache(maxsize=1)
def get_collection():
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(settings.chroma_dir))
    return client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=_embedding_function(),
    )

def delete_document_vectors(document_id: uuid.UUID) -> None:
    try:
        get_collection().delete(where={"document_id": {"$eq": str(document_id)}})
    except Exception:
        logger.exception("Chroma delete failed for document_id=%s", document_id)

def upsert_document_chunks(
    user_id: uuid.UUID,
    document_id: uuid.UUID,
    source_filename: str,
    chunks: list[tuple[int, int, str, str, str]],
) -> None:
    if not chunks:
        return
    coll = get_collection()
    uid, did = str(user_id), str(document_id)
    name = (source_filename or "")[:256]
    batch = 100
    for start in range(0, len(chunks), batch):
        part = chunks[start : start + batch]
        ids = [f"{did}:{c[0]}" for c in part]
        documents = [c[4] for c in part]
        metadatas = [
            {
                "user_id": uid,
                "document_id": did,
                "page": int(c[1]),
                "block_type": c[2],
                "parser_block_id": (c[3] or "")[:128],
                "chunk_index": int(c[0]),
                "file_name": name,
            }
            for c in part
        ]
        coll.upsert(ids=ids, documents=documents, metadatas=metadatas)

def query_similar(
    *,
    user_id: uuid.UUID,
    document_ids: list[uuid.UUID],
    question: str,
    top_k: int,
) -> tuple[list[str], list[dict]]:
    if not document_ids:
        return [], []
    
    coll = get_collection()
    uid = str(user_id)
    dids = [str(d) for d in document_ids]
    
    # Filters setup
    if len(dids) == 1:
        doc_filter = {"document_id": {"$eq": dids[0]}}
    else:
        doc_filter = {"$or": [{"document_id": {"$eq": d}} for d in dids]}
    where = {"$and": [{"user_id": {"$eq": uid}}, doc_filter]}

    # --- HYBRID STRATEGY STARTS HERE ---

    # 1. SEMANTIC SEARCH (Vector Matching)
    # BGE model ke liye instruction prefix lagana accuracy barhata hai
    query_for_bge = f"Represent this sentence for searching relevant passages: {question}"
    res = coll.query(query_texts=[query_for_bge], n_results=top_k, where=where)
    
    semantic_docs = (res.get("documents") or [[]])[0] or []
    semantic_metas = (res.get("metadatas") or [[]])[0] or []

    # 2. KEYWORD SEARCH (BM25) - Taake exact naam mil jayein
    # Is document ke saare chunks uthao taake unpe keyword search ho sake
    all_chunks = coll.get(where=where)
    all_texts = all_chunks.get("documents") or []
    all_metas = all_chunks.get("metadatas") or []

    if all_texts:
        # Simple tokenization (words mein divide karna)
        tokenized_corpus = [doc.lower().split() for doc in all_texts]
        bm25 = BM25Okapi(tokenized_corpus)
        query_tokens = question.lower().split()
        
        # Top 5 keyword matches dhoondo
        keyword_hits = bm25.get_top_n(query_tokens, list(zip(all_texts, all_metas)), n=5)
        
        # Results combine karein aur duplicate khatam karein
        combined_docs = list(semantic_docs)
        combined_metas = list(semantic_metas)
        
        for text, meta in keyword_hits:
            if text not in combined_docs:
                combined_docs.append(text)
                combined_metas.append(meta)

        return combined_docs[:top_k], combined_metas[:top_k]

    return semantic_docs, semantic_metas