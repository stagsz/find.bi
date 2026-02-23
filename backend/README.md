# find.bi Backend

Python 3.12 + FastAPI backend for find.bi.

## Tech Stack

- Python 3.12 + FastAPI
- SQLAlchemy + Alembic (ORM + migrations)
- PostgreSQL 15 (metadata database)
- DuckDB (analytical database, per-workspace files)
- Anthropic Claude API (AI analysis)
- OpenAI Realtime API (voice assistant)

## Setup

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

## Scripts

```bash
uvicorn main:app --reload   # Dev server
pytest                      # Run tests
mypy .                      # Type check
ruff check .                # Lint
```
