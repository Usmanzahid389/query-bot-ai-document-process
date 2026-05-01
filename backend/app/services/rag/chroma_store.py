from __future__ import annotations

import logging
import re
import uuid
from functools import lru_cache

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from rank_bm25 import BM25Okapi

from app.core.config import settings

logger = logging.getLogger(__name__)


_REF_PAT = re.compile(r"\b(?:clause|section|control)?\s*([a-z]?\d+(?:\.\d+)+)\b", re.IGNORECASE)
_TOKEN_PAT = re.compile(r"[a-z0-9]+(?:\.[a-z0-9]+)?", re.IGNORECASE)
_NOISE_PAT = re.compile(r"[`~|,_\-]{4,}")


@lru_cache(maxsize=1)
def _embedding_function() -> SentenceTransformerEmbeddingFunction:
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


def _tokenize(text: str) -> list[str]:
    return _TOKEN_PAT.findall((text or "").lower())


def _extract_numeric_refs(text: str) -> list[str]:
    refs = {m.group(1).lower() for m in _REF_PAT.finditer(text or "")}
    return sorted(refs)


def _has_exact_ref(text: str, ref: str) -> bool:
    # Boundary-safe exact reference match, so "8.2" does not match "8.22".
    pat = re.compile(rf"(?<![0-9a-z]){re.escape(ref)}(?![0-9a-z])", re.IGNORECASE)
    return bool(pat.search(text or ""))


def _noise_ratio(text: str) -> float:
    t = text or ""
    if not t:
        return 0.0
    noisy = sum(len(m.group(0)) for m in _NOISE_PAT.finditer(t))
    return noisy / max(len(t), 1)


def _rerank_candidates(
    question: str,
    docs: list[str],
    metas: list[dict],
    top_k: int,
) -> tuple[list[str], list[dict]]:
    if not docs:
        return [], []
    q_refs = _extract_numeric_refs(question)
    q_tokens = set(_tokenize(question))
    candidates: list[tuple[float, int, str, dict]] = []
    for idx, doc in enumerate(docs):
        meta = metas[idx] if idx < len(metas) else {}
        text = doc or ""
        lower = text.lower()
        score = 0.0
        if q_tokens:
            overlap = sum(1 for t in q_tokens if t in lower)
            score += overlap * 0.3
        if settings.rag_exact_numeric_match and q_refs:
            for ref in q_refs:
                if _has_exact_ref(lower, ref):
                    score += 6.0
                elif ref in lower:
                    score += 1.2
        if settings.rag_table_boost and str(meta.get("block_type") or "").lower() == "table":
            score += 0.35
        if settings.rag_noise_penalty:
            score -= min(2.0, _noise_ratio(text) * 8.0)
        # Keep semantic ordering as a mild tie-breaker to avoid regressions.
        score += max(0.0, 0.75 - (idx * 0.02))
        candidates.append((score, idx, doc, meta))
    candidates.sort(key=lambda x: (x[0], -x[1]), reverse=True)
    picked = candidates[: max(1, top_k)]
    return [p[2] for p in picked], [p[3] for p in picked]


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
    query_for_bge = f"Represent this sentence for searching relevant passages: {question}"
    res = coll.query(query_texts=[query_for_bge], n_results=top_k, where=where)

    semantic_docs = (res.get("documents") or [[]])[0] or []
    semantic_metas = (res.get("metadatas") or [[]])[0] or []

    # 2. KEYWORD SEARCH (BM25)
    all_chunks = coll.get(where=where)
    all_texts = all_chunks.get("documents") or []
    all_metas = all_chunks.get("metadatas") or []

    combined_docs = list(semantic_docs)
    combined_metas = list(semantic_metas)

    if all_texts:
        tokenized_corpus = [_tokenize(doc) for doc in all_texts]
        bm25 = BM25Okapi(tokenized_corpus)
        query_tokens = _tokenize(question)
        n_kw = max(1, min(int(settings.rag_keyword_top_n), len(all_texts)))
        keyword_hits = bm25.get_top_n(query_tokens, list(zip(all_texts, all_metas)), n=n_kw)
        for text, meta in keyword_hits:
            if text not in combined_docs:
                combined_docs.append(text)
                combined_metas.append(meta)

    if settings.rag_rerank_enabled:
        return _rerank_candidates(question, combined_docs, combined_metas, top_k)

    return combined_docs[:top_k], combined_metas[:top_k]