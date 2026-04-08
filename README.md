# QueryBot MVP

AI-powered document Q&A web app: **Next.js 14** frontend, **FastAPI** backend, **JWT** auth, **SQLite** (async) for local dev, and **mock AI** isolated in `backend/app/services/ai_service.py`.

## Repository layout

- `backend/` — FastAPI app (`uvicorn app.main:app`)
- `frontend/` — Next.js App Router (`npm run dev`)

## Prerequisites

- Python 3.10+
- Node.js 18+

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

`requirements.txt` pins `bcrypt==4.0.1` so `passlib` password hashing works reliably on current Python versions.

Create `backend/.env` (optional; defaults work for local dev):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Async SQLAlchemy URL | `sqlite+aiosqlite:///./querybot.db` |
| `JWT_SECRET` | Secret for signing JWTs | (dev default in `config.py` — change in production) |
| `JWT_ALGORITHM` | Algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `10080` (7 days) |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,http://127.0.0.1:3000` |
| `UPLOAD_DIR` | Directory for uploaded files | `backend/uploads` |
| `MAX_UPLOAD_BYTES` | Max file size | `10485760` (10 MB) |

Run the API (default port **8000**):

```bash
cd backend
source .venv/bin/activate
export PYTHONPATH=.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- OpenAPI docs: `http://127.0.0.1:8000/docs`
- Health: `GET /health`

## Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Base URL of the FastAPI backend | `http://127.0.0.1:8000` |

Run the web UI:

```bash
cd frontend
npm run dev
```

App: `http://localhost:3000` — register, upload PDF/DOCX/TXT (≤ 10 MB), chat (mock answers), summaries, export chat/summary as PDF or DOCX.

## MVP notes

- All LLM output is **mocked** in `backend/app/services/ai_service.py`; routes and DB stay stable for a future RAG swap.
- English UI; extracted text is stored for each upload (text-based PDFs/DOCX; no OCR).

## Production hints

- Set a strong `JWT_SECRET`, use PostgreSQL (`DATABASE_URL` with `postgresql+asyncpg://...`), and restrict `CORS_ORIGINS`.
- Deploy frontend (e.g. Vercel) and backend (e.g. Railway); point `NEXT_PUBLIC_API_URL` at the public API URL.
