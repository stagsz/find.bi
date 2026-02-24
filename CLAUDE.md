# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

You are building **find.bi** — a self-hosted, local-first Business Intelligence platform with interactive dashboards, AI-powered data analysis, and a conversational voice assistant. It is a personal alternative to Power BI and Tableau that runs entirely on the user's own machine.

**Tagline:** Your data talks. Ralph listens.

---

## ALWAYS DO FIRST

**Before writing any frontend code — every session, no exceptions:**

> Invoke the `frontend-design` skill.

This applies to every React component, page, layout, or style change. The skill enforces the find.bi aesthetic (retro-futuristic editorial, amber-on-dark, distinctive typography). Skipping it produces generic UI that violates the design spec in `PRD.json`.

---

## Your Role

You are the autonomous builder in the Ralph Wiggum Loop. You:
- Read `IMPLEMENTATION_PLAN.md` to find the next unchecked task
- Implement exactly that task — no more, no less
- Write tests for what you build
- Commit with a clear message
- Mark the task done in `IMPLEMENTATION_PLAN.md`
- Stop and wait for the next loop iteration

Do not skip ahead. Do not refactor things not in the current task. Do not add features not in the plan.

---

## Workflow Commands

### Project Setup (first time)
```powershell
# Windows
.\setup_project.ps1

# Mac/Linux
./setup_project.sh
```

### Planning mode — generates IMPLEMENTATION_PLAN.md from PRD.json
```bash
./loop.sh plan          # Mac/Linux
.\loop.ps1 plan         # Windows PowerShell
```

### Build mode — implements one task per loop iteration
```bash
./loop.sh build         # unlimited iterations
./loop.sh build 20      # max 20 iterations
./loop.sh 20            # shorthand for build with max 20
.\loop.ps1 build        # Windows
```

### Quality evaluation (run in parallel with build loop)
```powershell
.\evaluate_loop.ps1                              # default: every 10 min
.\evaluate_loop.ps1 -IntervalMinutes 5 -MaxRuns 10
```

### Prompt injection security scan
```powershell
.\check_prompt_injection.ps1
```

### Once frontend is scaffolded
```bash
cd frontend && npm run dev        # dev server (Vite)
cd frontend && npm run build      # production build
cd frontend && npm run typecheck  # TypeScript check
cd frontend && npm run lint       # ESLint
cd frontend && node node_modules/vitest/vitest.mjs run                        # Vitest (all tests)
cd frontend && node node_modules/vitest/vitest.mjs run path/to/file.test.ts   # single test file
# NOTE: npm test / npx vitest do not work in this bash-on-Windows environment
```

### Once backend is scaffolded
```bash
cd backend && python -m uvicorn main:app --reload   # dev server (uvicorn not on PATH on Windows, use python -m)
cd backend && python -m pytest -x -q --tb=short     # all tests
cd backend && python -m pytest tests/test_auth.py  # single test file
cd backend && python -m mypy .                     # type check
cd backend && python -m ruff check .               # lint
```

### Docker (full stack)
```bash
docker compose up -d          # start all services (PostgreSQL)
docker compose down           # stop
docker compose logs -f        # follow logs
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Charts (standard) | Apache ECharts — Apache License 2.0 |
| Charts (exploratory/AI) | Observable Plot — ISC License |
| Geo Visualization | Deck.gl (MIT) + MapLibre GL JS (BSD 3-Clause) |
| Query Engine | DuckDB-WASM (runs in browser, zero backend for queries) |
| SQL Editor | Monaco Editor |
| Dashboard Layout | react-grid-layout |
| Backend | Python 3.12 + FastAPI |
| ORM | SQLAlchemy + Alembic |
| Metadata DB | PostgreSQL 15 |
| Analytical DB | DuckDB (per-workspace .db files) |
| AI Analysis | Anthropic Claude API (claude-sonnet-4-6) |
| AI Voice STT+LLM | OpenAI Realtime API (GPT-4o, WebSocket) |
| AI Voice TTS | OpenAI TTS API (streaming) |
| STT Fallback | Web Speech API (browser-native) |
| Containers | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| Automation | n8n webhooks |
| CI/CD | GitHub Actions |

---

## Repository Structure

```
find.bi/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/          # Apache ECharts wrappers (Bar, Line, Area, Scatter, Pie, KPI, Table)
│   │   │   ├── explore/         # Observable Plot components for AI-generated exploratory charts
│   │   │   ├── geo/             # Deck.gl layers (Scatterplot, Hexagon, Arc, Heatmap, GeoJson)
│   │   │   ├── dashboard/       # Grid builder, card, filter components
│   │   │   ├── editor/          # Monaco SQL editor, schema explorer
│   │   │   ├── voice/           # Push-to-talk, wake word, transcript
│   │   │   └── ai/              # Chat panel, insight cards, deck viewer
│   │   ├── hooks/
│   │   │   ├── useDuckDB.ts     # DuckDB-WASM initialization and query
│   │   │   ├── useVoice.ts      # OpenAI Realtime API WebSocket
│   │   │   └── useAI.ts         # Claude API calls
│   │   └── services/
│   │       ├── api.ts           # FastAPI client
│   │       ├── duckdb.ts        # DuckDB-WASM setup
│   │       └── voice.ts         # WebSocket voice stream
├── backend/
│   ├── api/
│   │   ├── auth.py              # JWT login/register
│   │   ├── data.py              # File upload, ingest to DuckDB
│   │   ├── dashboards.py        # CRUD for dashboard configs
│   │   ├── ai.py                # Claude API proxy (text-to-SQL, insights)
│   │   ├── voice.py             # OpenAI Realtime API proxy
│   │   └── n8n.py               # Webhook receiver endpoints
│   ├── services/
│   │   ├── ai_service.py        # Claude integration logic
│   │   ├── duckdb_service.py    # Server-side DuckDB operations
│   │   ├── alert_service.py     # Threshold monitoring
│   │   └── export_service.py    # PDF, CSV, Excel export
│   ├── models/
│   │   ├── user.py
│   │   ├── workspace.py
│   │   ├── dashboard.py
│   │   └── alert.py
│   └── alembic/                 # Database migrations
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.dev.yml
└── .github/workflows/
    └── ci.yml
```

---

## Architecture Principles

**Local-first:** DuckDB-WASM runs queries entirely in the browser. Data never leaves the user's machine unless they explicitly configure external connections.

**Zero SaaS dependency for core features:** The app works without any API keys. AI features require Anthropic/OpenAI keys but are optional enhancements.

**Everything is a file:** Dashboards save as portable JSON. DuckDB stores analytical data as .db files. Configs are YAML. Nothing is locked in a proprietary format.

**One task at a time:** The loop builds one feature per iteration. Each feature must be fully working with tests before the next begins.

---

## Key Patterns

### Visualization Strategy — Two Libraries, Two Purposes

**Apache ECharts** — for all standard dashboard charts
- Use for: Bar, Line, Area, Scatter, Pie, Donut, Radar, KPI cards, Data Tables
- Configured via JSON option objects
- Handles 10M+ data points via progressive rendering
- Canvas + SVG dual rendering
- All charts user-places on dashboard grid use ECharts

**Observable Plot** — for AI-generated exploratory charts only
- Use for: AI chat panel responses, text-to-SQL result previews, insight cards
- Claude generates Plot mark specs as JSON (declarative, reliable, short)
- Much easier for Claude to generate correctly than imperative ECharts config
- Users can "promote" a Plot chart to a full ECharts dashboard card
- Do NOT use Observable Plot for permanent dashboard cards

```typescript
// ECharts — standard dashboard chart
const option = {
  xAxis: { type: 'category', data: regions },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: revenues }]
}

// Observable Plot — AI exploratory chart (Claude generates this spec)
Plot.plot({
  marks: [
    Plot.barY(data, { x: 'region', y: 'revenue', fill: 'steelblue' })
  ]
})
```
```typescript
// All analytical queries run client-side via DuckDB-WASM
const { query, loading, error } = useDuckDB()
const result = await query('SELECT region, SUM(revenue) FROM sales GROUP BY region')
```

### Deck.gl Geo Visualization Pattern
```typescript
// Use @deck.gl/react for GPU-accelerated map layers
// Always check for lat/lon or geographic columns before suggesting map chart
// Layer selection logic:
//   lat/lon columns + count data     → ScatterplotLayer
//   lat/lon columns + density        → HexagonLayer or HeatmapLayer
//   origin/destination column pairs  → ArcLayer
//   GeoJSON column or region codes   → GeoJsonLayer
//
// Never load full dataset into Deck.gl state — pipe through DuckDB-WASM query first
// MapLibre GL JS provides the base map (free, no API key required for basic tiles)
```

### Claude API Call (backend proxy)
```python
# backend/services/ai_service.py
# Always send: user question + full schema + sample rows (max 50)
# Never send: full dataset to Claude
```

### Voice Flow
```
Microphone → MediaStream API → WebSocket → OpenAI Realtime API (GPT-4o)
→ Intent classified → if data query: Claude API → DuckDB → chart rendered
→ Audio response streamed → played via Web Audio API
```

### API Key Storage
```python
# Never expose API keys to frontend
# Store encrypted in PostgreSQL
# Load via environment variables in Docker Compose
```

---

## Build Phases

| Phase | Name | Goal |
|---|---|---|
| 1 | Foundation | Docker stack, file upload, DuckDB-WASM, charts, dashboard builder, SQL editor, auth |
| 2 | Intelligence | Claude text-to-SQL, AI insights, chat panel, deck generator, Deck.gl geo-visualization |
| 3 | Voice | Hey Ralph voice assistant, push-to-talk, wake word, spoken responses |
| 4 | Connectivity | n8n webhooks, DB connectors, scheduled refresh, alerts, export |

**Always build Phase 1 completely before starting Phase 2.**

---

## Testing Requirements

- **Frontend:** Vitest + React Testing Library for components. Test each chart renders with mock data.
- **Backend:** Pytest for all API routes. Test auth, data ingestion, AI proxy endpoints.
- **Integration:** Test DuckDB-WASM query execution in browser context.
- **Each task must include tests before marking done.**

---

## Commit Convention

```
feat(F001): Docker Compose stack with FastAPI, React, PostgreSQL, Nginx
feat(F002): CSV/JSON/Parquet/Excel file ingestion with schema detection
fix(F003): DuckDB-WASM initialization race condition on slow connections
test(F004): Add chart rendering tests for all 5 chart types
```

Format: `type(feature-id): description`

---

## Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://ralph:ralph@postgres:5432/ralph
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
JWT_SECRET=<generated>
DUCKDB_PATH=/data/workspaces

# Frontend (.env)
VITE_API_URL=http://localhost:8000
```

---

## Performance Targets

| Metric | Target |
|---|---|
| SQL query (up to 10M rows) | < 500ms |
| Chart render after query | < 200ms |
| Voice round trip (speech → response audio) | < 800ms |
| File upload + schema detection (100MB CSV) | < 10s |

---

## Personality & Easter Eggs

Ralph has a personality based on Ralph Wiggum from The Simpsons — friendly, slightly dim but occasionally profound.

- Idle too long: *"My cat's breath smells like cat food"*
- Loading: Springfield Elementary chalkboard phrases
- 404 page: *"I'm in danger"*
- Low AI confidence: *"I don't know what's happening but I can feel it"*
- Successful deck generation: *"I made something with my brain!"*

These are implemented as UI copy, not backend logic. Low priority — add after core functionality works.

---

## What NOT To Do

- Do not use Recharts — replaced by Apache ECharts
- Do not use Mapbox GL JS — use MapLibre GL JS (BSD, no API key required)
- Do not use any visualization library without a permissive open source license
- Do not use any SaaS database (Supabase, PlanetScale, etc.) — PostgreSQL local only
- Do not send full datasets to Claude — schema + sample rows only
- Do not expose API keys to the frontend under any circumstances
- Do not build Phase 2+ features during Phase 1
- Do not refactor working code unless it blocks the current task
- Do not use localStorage for sensitive data

---

## References

- Apache ECharts: https://echarts.apache.org (Apache License 2.0)
- Observable Plot: https://observablehq.com/plot (ISC License)
- DuckDB-WASM: https://github.com/duckdb/duckdb-wasm (MIT)
- Deck.gl: https://deck.gl (MIT)
- MapLibre GL JS: https://maplibre.org (BSD 3-Clause)
- OpenAI Realtime API: https://openai.com/index/introducing-the-realtime-api/
- Anthropic Claude API: https://docs.anthropic.com
- react-grid-layout: https://github.com/react-grid-layout/react-grid-layout
