import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv


def _status_from_error_payload(payload: dict) -> str:
    err = payload.get("error", {}) if isinstance(payload, dict) else {}
    code = err.get("code")
    message = str(err.get("message", ""))
    if code == 401 or "unauthorized" in message.lower() or "user not found" in message.lower():
        return "INVALID_KEY"
    if code == 429 or "rate" in message.lower():
        return "RATE_LIMITED"
    if code == 404 or "model" in message.lower():
        return "MODEL_UNAVAILABLE"
    return "ERROR"


def main() -> None:
    load_dotenv()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "").strip()
    base_url = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1").strip().rstrip("/")

    if not api_key:
        print("STATUS: INVALID_CONFIG")
        print("DETAIL: LLM_API_KEY is missing in .env")
        return
    if not model:
        print("STATUS: INVALID_CONFIG")
        print("DETAIL: LLM_MODEL is missing in .env")
        return

    url = f"{base_url}/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
        "max_tokens": 8,
        "temperature": 0,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
        parsed = json.loads(body) if body else {}
        text = ""
        try:
            text = parsed["choices"][0]["message"]["content"]
        except Exception:
            text = "(no assistant text found)"
        print("STATUS: AVAILABLE")
        print(f"MODEL: {model}")
        print(f"DETAIL: {text}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"error": {"message": raw}}
        status = _status_from_error_payload(payload)
        print(f"STATUS: {status}")
        print(f"MODEL: {model}")
        print(f"HTTP: {e.code}")
        print(f"DETAIL: {payload}")
    except Exception as e:
        print("STATUS: ERROR")
        print(f"MODEL: {model}")
        print(f"DETAIL: {e}")


if __name__ == "__main__":
    main()
