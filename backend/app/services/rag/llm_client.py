from __future__ import annotations

from app.core.config import settings


def chat_completion(*, system_prompt: str, user_message: str) -> str:
    from openai import OpenAI

    if not (settings.llm_api_key or "").strip():
        raise ValueError("LLM_API_KEY is not set")
    kwargs: dict = {"api_key": settings.llm_api_key.strip()}
    base = (settings.llm_base_url or "").strip().rstrip("/")
    if base:
        kwargs["base_url"] = base
    client = OpenAI(**kwargs)
    resp = client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.15,
        timeout=settings.llm_timeout_seconds,
    )
    raw = resp.choices[0].message.content
    return (raw or "").replace("\x00", "").strip()
