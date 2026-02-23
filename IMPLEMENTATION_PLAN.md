# Implementation Plan

> **Ralph Workflow**: Do tasks in order. One at a time. Update this file after each commit.

## Current Status

**Phase**: 1 - Foundation
**Progress**: 36 / 100 tasks
**Last Completed**: CHART-06
**Last Reviewed**: 2026-02-23
**Blockers**: None
**Code state**: Docker Compose configured. `.env.example` provides template for all environment variables. Backend and frontend Dockerfiles ready. Nginx reverse proxy configured with API proxy, WebSocket upgrade for voice, and SPA fallback. GitHub Actions CI workflow added with backend (pytest+ruff+mypy) and frontend (vitest+eslint+typecheck) jobs. Backend scaffolded: FastAPI app with CORS, health endpoint, pyproject.toml for tooling, conftest.py with test client fixture, httpx added for TestClient. CI backend gate now activates (pyproject.toml exists). SQLAlchemy engine + sessionmaker configured in db.py with get_db FastAPI dependency. Alembic initialized with env.py reading DATABASE_URL from environment, migration template ready, versions directory created. Alembic directory excluded from mypy/ruff. Base declarative model class created with UUID primary key, created_at, updated_at columns. Alembic target_metadata wired to Base.metadata. User model created with email (unique, indexed), password_hash, and display_name columns. First Alembic migration (001) creates users table with index on email. Models package updated to export User; alembic env.py imports all models for autogenerate. Frontend scaffolded: React 18 + Vite 6 + TypeScript 5.7, Tailwind CSS v4 via @tailwindcss/vite plugin, ESLint flat config, Vitest with jsdom + @testing-library/react, @/ path alias configured. CI frontend gate now activates (package.json exists). App shell layout with collapsible sidebar navigation (Home, Dashboards, SQL Editor, Upload), top bar with dynamic page title, React Router v6 routes (/, /dashboard/:id, /editor, /upload), and placeholder page components. react-router-dom and @testing-library/user-event installed. API client service added: axios instance with VITE_API_URL base, request interceptor for JWT Bearer token, response interceptor clearing token on 401, token stored in memory. Auth service added: bcrypt password hashing, JWT access tokens (HS256, configurable expiry via JWT_EXPIRY_MINUTES), register_user with duplicate email check, authenticate_user with credential verification, get_current_user with token decode + DB lookup. Auth API routes added: POST /api/auth/register (201, email validation, duplicate check), POST /api/auth/login (JWT token response), POST /api/auth/refresh (new JWT from valid token), GET /api/auth/me (Bearer token auth). Reusable get_authenticated_user FastAPI dependency for protecting routes. email-validator added to requirements.txt. 60 backend tests across 7 test files. Login/register UI added: AuthProvider context with useAuth hook (user state, login/register/logout), LoginPage and RegisterPage as full-screen centered forms outside sidebar layout, JWT stored in memory via api.ts, register auto-logs in user, form validation with error display. Auth guards added: ProtectedRoute wrapper component redirects unauthenticated users to /login via React Router Outlet pattern. Logout button added to sidebar footer with user display name. Token auto-refresh schedules POST /api/auth/refresh 2 minutes before JWT expiry; login/refresh responses include expires_in field. 57 frontend tests across 8 test files. Auth system complete. Workspace model added with UUID id, name, owner_id (FK to users with CASCADE delete), and duckdb_path. Alembic migration 002 creates workspaces table with index on owner_id. Registration now auto-creates a "Default Workspace" per user with duckdb_path at `{DUCKDB_PATH}/{user_id}/default.db`. Models package exports Workspace. Workspace API routes added: GET /api/workspaces (list user's workspaces), POST /api/workspaces (create with auto-generated DuckDB path), DELETE /api/workspaces/:id (owner-scoped with UUID validation). All workspace routes require Bearer token auth. File upload API added: POST /api/data/upload accepts multipart file (CSV, JSON, Parquet, Excel) with workspace_id form field. Validates file extension against allowlist (.csv, .json, .parquet, .xlsx, .xls), enforces 500MB max size, rejects empty files, verifies workspace ownership. Saves files to `{DUCKDB_PATH}/{user_id}/{workspace_id}/uploads/{uuid}{ext}` with UUID-based safe filenames. Returns file_id, filename, size, content_type, path. Data router registered in main.py. Schema detection service added: `backend/services/schema_service.py` uses server-side DuckDB to sniff column names, types, and row count from uploaded files. Supports CSV (read_csv_auto), JSON (read_json_auto), Parquet (read_parquet), Excel (st_read via spatial extension). Returns simplified frontend-friendly type names (integer, float, string, boolean, date, datetime) alongside raw DuckDB types. Handles errors gracefully (missing files, unsupported extensions, corrupted files raise ValueError). duckdb>=1.1 added to requirements.txt. mypy override added for duckdb module. DuckDB ingestion service added: `backend/services/duckdb_service.py` loads uploaded files into workspace DuckDB .db files as named tables. `ingest_file()` sanitizes table names (strips special chars, leading digits), auto-resolves duplicates by appending `_2`, `_3` suffixes, returns table metadata (columns, types, row_count). `list_tables()` returns all tables with schema info. `drop_table()` removes a table by name. Reuses `_friendly_type` and `_read_function` from schema_service. 177 backend tests across 12 test files. Data source API added: GET /api/data/sources?workspace_id= lists all tables in workspace DuckDB with column metadata (name, type, duckdb_type) and row counts. DELETE /api/data/sources/:name?workspace_id= drops a table. Both endpoints validate workspace ownership, return 404 for missing workspace or table. Shared _get_workspace_db_path helper extracts workspace validation. 195 backend tests across 13 test files. Upload UI complete. Backend schema detection endpoint (POST /api/data/detect-schema) and ingestion endpoint (POST /api/data/ingest) added to data router with file-path validation ensuring files stay within user workspace directories. UploadPage.tsx rebuilt with drag-and-drop zone (click or drag), upload progress bar, schema preview table (column names, friendly types, DuckDB types, row count), editable table name with derived default, and Confirm & Import button triggering DuckDB ingestion. Success state shows table name, row count, columns with Upload Another button. Cancel button returns to drop zone. Client-side validation rejects unsupported extensions, empty files, and oversized files. 16 frontend tests across UploadPage, 14 backend tests for detect-schema and ingest endpoints. Pre-existing lint/type issues in api.test.ts and test_data_upload_api.py fixed. 209 backend tests across 14 test files. 73 frontend tests across 9 test files. DuckDB-WASM initialized: `frontend/src/services/duckdb.ts` provides singleton `initDuckDB()` with automatic bundle selection (EH > MVP), OPFS persistence when cross-origin isolated, in-memory fallback otherwise. Vite config updated with `optimizeDeps.exclude` for @duckdb/duckdb-wasm, COOP/COEP headers on dev server. 86 frontend tests across 10 test files (13 new DuckDB tests). useDuckDB hook added: `frontend/src/hooks/useDuckDB.tsx` with DuckDBProvider context wrapping AppLayout (scoped to authenticated users), useDuckDB hook providing `query(sql)` returning `{ columns, rows, duration }`, per-component loading/error state, connection-per-query pattern with auto-close. Arrow Table results converted to plain `string[]` columns + `unknown[][]` rows. DuckDBProvider initializes on mount with cancellation on unmount. 100 frontend tests across 11 test files (14 new useDuckDB tests). Data loading bridge complete: `export_table()` added to backend duckdb_service.py exports tables as Parquet/CSV via DuckDB COPY TO. GET /api/data/export/{table_name} endpoint serves table data with format param (parquet default, csv), FileResponse with background temp file cleanup. Frontend `loadTable(db, tableName, fileUrl, authToken?)` added to duckdb.ts — fetches file, detects format from content-type/URL, registers via `registerFileBuffer`, creates table with `CREATE OR REPLACE TABLE`. useDuckDB hook exposes `loadTable(tableName, fileUrl)` with automatic auth token injection and loading/error state. UploadPage wired to call loadTable after successful ingestion (non-fatal on failure). 226 backend tests across 15 test files. 115 frontend tests across 11 test files. Query execution tests added: `useDuckDB.queries.test.tsx` with 31 tests covering SELECT (with WHERE, ORDER BY, LIMIT, DISTINCT, aliases), GROUP BY (single/multiple columns, HAVING, ORDER BY on aggregates), aggregations (COUNT, SUM, AVG, MIN, MAX, COUNT DISTINCT, multiple aggregations, null on empty table), JOINs (INNER, LEFT with nulls, JOIN with aggregation, self JOIN, empty JOIN result), result shape verification (column count matches row width, data type preservation, large result sets, duration, wide results), and sequential query execution (multiple queries, connection-per-query lifecycle, error isolation). 146 frontend tests across 12 test files. ECharts base wrapper added: `frontend/src/components/charts/EChart.tsx` — generic wrapper accepting ECharts option objects, manages init/resize/dispose lifecycle via ResizeObserver, supports Canvas and SVG rendering modes via `renderer` prop, theme support, loading state overlay, onInit callback for chart instance access. Tree-shakeable imports register Bar, Line, Pie, Scatter, Radar charts plus Title, Tooltip, Legend, Grid, Dataset, Transform, Toolbox components. 164 frontend tests across 13 test files (18 new EChart tests). Bar chart component added: `frontend/src/components/charts/BarChart.tsx` wraps EChart with data-driven props (data array, xField, yField, title, horizontal). Generates ECharts bar option with category/value axis swap for horizontal mode. Handles empty data, non-numeric values, missing fields gracefully. 180 frontend tests across 14 test files (16 new BarChart tests). Line and Area chart components added: `LineChart.tsx` supports single-line and multi-line (via series prop) with smooth option. `AreaChart.tsx` adds linear gradient fills (top-to-bottom opacity) with 5 distinct color palettes cycling per series. Both follow BarChart pattern — useMemo for option generation, same prop interface (data, xField, yField, className, style, loading, renderer). Multi-series mode adds legend and uses series names as data field keys. 221 frontend tests across 16 test files (41 new tests: 20 LineChart + 21 AreaChart). Scatter chart component added: `ScatterChart.tsx` with data-driven props (xField, yField, optional sizeField with normalized symbolSize 5-40px, optional colorField grouping data into separate series with legend). Custom tooltip formatter shows all fields on hover. Both axes use value type (not category). 244 frontend tests across 17 test files (23 new ScatterChart tests). Pie/Donut chart component added: `PieChart.tsx` with data-driven props (nameField, valueField, donut boolean). Donut mode renders inner/outer radius ["40%", "70%"]. Includes vertical legend, percentage label formatter ({b}: {d}%), item tooltip with value and percentage, emphasis shadow effect. 266 frontend tests across 18 test files (22 new PieChart tests). Radar chart component added: `RadarChart.tsx` with typed props — `data: RadarSeries[]` (name + values array), `indicators: RadarIndicator[]` (name + max). Area fill with 0.3 opacity on each series. Includes legend, item tooltip. Exports RadarIndicator and RadarSeries types. 290 frontend tests across 19 test files (24 new RadarChart tests). Ready for CHART-07 (KPI card).

---

## Phase 1: Foundation

> **Goal**: Working local BI tool — file upload, charts, SQL editor, dashboard builder, auth
> **Features**: F001, F002, F003, F004, F005, F006, F007, F008, F009

### 1.0 Legacy Cleanup (prerequisite)

- [x] CLEANUP-01: Remove old HazOp project code and resolve all conflict markers.
  **Context**: Merge commit `cc358a4` completed the git merge, but conflict markers (`<<<<<<<`) were committed into several files. The git index is clean — no UU/AA status — but the file contents need fixing.
  **Delete directories (entire trees):** `apps/`, `packages/`, `migrations/`, `e2e/`, `test-results/`, `docs/`, `scripts/` (recreated in SETUP-01), `docker/grafana/`, `docker/loki/`, `docker/prometheus/`, `docker/nginx/` (recreated in SETUP-06), `.github/` (recreated in SETUP-07).
  **Delete root files:** `architecture.md`, `docker-compose.prod.yml`, `nx.json`, `package.json` (recreated for frontend), `tsconfig.base.json`, `RalphTemplate.code-workspace`, `UI_DESCRIPTION.md`, `private.pem`, `public.pem`, `.eslintrc.json`, `.prettierrc.json`, `.prettierignore`, `.dockerignore`, `.env.production.example`.
  **Delete HazOp scripts:** `check-schema.js`, `check-user.js`, `fix-minio-cors.js`, `mark-docs-processed.js`, `mark-documents-processed.sql`, `test-create-analysis.js`, `test-db.sql`, `test-minio.js`, `setup-schema.sql`.
  **Delete docker configs:** `docker/migrate-entrypoint.sh`.
  **Keep (do NOT delete):** `CLAUDE.md`, `IMPLEMENTATION_PLAN.md`, `AGENTS.md`, `findbi.code-workspace`, `hooks/`, `loop.ps1`, `loop.sh`, `loop.bat`, `evaluate_loop.ps1`, `check_prompt_injection.ps1`, `PROMPT_Build.md`, `PROMPT_Plan.md`, `specs/`, `setup_project.ps1`, `setup_project.sh`, `.claude/`.
  **Remove conflict markers** from these 6 committed files (keep find.bi content, discard HazOp content in each):
  - `README.md` (2 conflict blocks)
  - `QUICKSTART.md` (1 conflict block)
  - `PROMPT_Build.md` (2 conflict blocks)
  - `setup_project.sh` (3 conflict blocks)
  - `setup_project.ps1` (7 conflict blocks)
  - `.claude/settings.local.json` (1 conflict block) — also add to `.gitignore`
  **Already clean (no action needed):** `PRD.json`, `CLAUDE.md` — these have no conflict markers.
  **Replace** `docker-compose.yml` (currently HazOp services: Redis, MinIO, RabbitMQ, Prometheus, Loki, Grafana) — will be recreated in SETUP-02.
  **Replace** `.env.example` (currently HazOp config) — will be recreated in SETUP-03.
  **Update** `.gitignore` for find.bi project structure (remove "CRM runtime" references, add `backend/`, `frontend/`, DuckDB paths, `.claude/settings.local.json`, `ralph_log_*`).
  Commit clean slate.

### 1.1 Project Setup & Docker Stack (F001)

- [x] SETUP-01: Create directory structure — `frontend/`, `backend/`, `docker/`, `.github/workflows/`, `scripts/`. Add placeholder READMEs in each.
- [x] SETUP-02: Create `docker-compose.yml` for find.bi — PostgreSQL 15 (ralph/ralph) only. Create `docker-compose.dev.yml` adding FastAPI + React dev containers with hot reload and volume mounts.
- [x] SETUP-03: Create `.env.example` for find.bi — DATABASE_URL, JWT_SECRET, DUCKDB_PATH, ANTHROPIC_API_KEY, OPENAI_API_KEY, VITE_API_URL. Clean environment file with no HazOp references. *(e65a7f1)*
- [x] SETUP-04: Create `docker/Dockerfile.backend` — Python 3.12 slim, install dependencies from requirements.txt, uvicorn entrypoint on port 8000. *(08c08aa)*
- [x] SETUP-05: Create `docker/Dockerfile.frontend` — Node 20 alpine, npm install, Vite build, serve with nginx. Multi-stage build. *(a00b4f0)*
- [x] SETUP-06: Create `docker/nginx.conf` — Reverse proxy: `/api` to backend:8000, `/` to frontend static files. WebSocket upgrade support for voice. *(7baa760)*
- [x] SETUP-07: Create `.github/workflows/ci.yml` — On push/PR: run backend pytest + ruff + mypy, run frontend vitest + eslint + typecheck. *(357fe2a)*

### 1.2 Backend Scaffold (F001)

- [x] API-01: Scaffold FastAPI backend — `backend/main.py` with CORS, health endpoint (`GET /api/health`). Add `requirements.txt` with fastapi, uvicorn, sqlalchemy, alembic, psycopg2-binary, python-jose, bcrypt, python-multipart. Add `backend/pyproject.toml` with ruff and mypy config. Add `backend/conftest.py` with test client fixture. *(635b434)*
- [x] API-02: Configure SQLAlchemy + Alembic — `backend/db.py` with async engine and session. `backend/alembic.ini` and `backend/alembic/env.py`. Verify connection to PostgreSQL in Docker. *(a088785)*
- [x] API-03: Create base model classes — `backend/models/base.py` with Base declarative class, id (UUID), created_at, updated_at columns. Add `backend/models/__init__.py`. *(9576126)*

### 1.3 Frontend Scaffold (F001)

- [x] UI-01: Scaffold React + Vite + TypeScript frontend — `npm create vite@latest frontend -- --template react-ts`. Add Tailwind CSS v4. Configure path aliases (`@/`). Add `.eslintrc.cjs` and `tsconfig.json`. Verify `npm run dev` starts. *(3e9dbf9)*
- [x] UI-02: Create app shell layout — `App.tsx` with sidebar navigation (collapsible), top bar, and main content area using Tailwind. Add React Router v6 with routes: `/`, `/dashboard/:id`, `/editor`, `/upload`. Create placeholder page components. *(25344eb)*
- [x] UI-03: Add API client service — `frontend/src/services/api.ts` with axios instance, base URL from `VITE_API_URL`, request/response interceptors for JWT token, error handling. *(b0f2efa)*

### 1.4 User Authentication (F008)

- [x] AUTH-01: Create User model — `backend/models/user.py` with id (UUID), email (unique), password_hash, display_name, created_at. Create Alembic migration. Write model test. *(8700aa3)*
- [x] AUTH-02: Create auth service — `backend/services/auth_service.py` with register (bcrypt hash), login (verify + generate JWT), get_current_user (decode JWT). JWT with HS256, configurable expiry. *(20c1800)*
- [x] AUTH-03: Create auth API routes — `backend/api/auth.py` with `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`. Add auth dependency for protected routes. Write pytest tests for all 3 endpoints. *(e5e38a4)*
- [x] AUTH-04: Create login/register UI — `frontend/src/pages/LoginPage.tsx` and `RegisterPage.tsx`. Email + password form with validation. Store JWT in memory (not localStorage). Add `useAuth` hook with context provider. Redirect to dashboard on success. *(ab0c56a)*
- [x] AUTH-05: Add auth guards — Protected route wrapper component. Redirect to `/login` if no token. Auto-refresh token before expiry. Add logout button to sidebar. *(f9f66b3)*

### 1.5 Workspace Model (F008, F009)

- [x] DB-01: Create Workspace model — `backend/models/workspace.py` with id (UUID), name, owner_id (FK to user), duckdb_path, created_at. Create Alembic migration. Each user gets a default workspace on registration. *(577f103)*
- [x] DB-02: Create Workspace API routes — `backend/api/workspaces.py` with `GET /api/workspaces`, `POST /api/workspaces`, `DELETE /api/workspaces/:id`. Scoped to authenticated user. Write pytest tests. *(7a05f1e)*

### 1.6 File Ingestion (F002)

- [x] DATA-01: Create file upload API — `backend/api/data.py` with `POST /api/data/upload` accepting multipart file (CSV, JSON, Parquet, Excel). Validate file type and size (max 500MB). Save to workspace data directory. Write tests with sample files. *(612cb18)*
- [x] DATA-02: Create schema detection service — `backend/services/schema_service.py`. Use DuckDB (server-side) to sniff column names, types, row count from uploaded file. Return schema as JSON. Support CSV, JSON, Parquet, Excel. Write tests. *(1905d1c)*
- [x] DATA-03: Create DuckDB ingestion service — `backend/services/duckdb_service.py`. Load uploaded file into workspace DuckDB database as a named table. Handle duplicate table names. Return table metadata. Write tests. *(7d92f26)*
- [x] DATA-04: Create data source list API — `backend/api/data.py` add `GET /api/data/sources` returning all tables in workspace DuckDB with schema info. Add `DELETE /api/data/sources/:name` to drop table. Write tests. *(3d0d21b)*
- [x] DATA-05: Create upload UI — `frontend/src/pages/UploadPage.tsx` with drag-and-drop zone (or click to browse). Show upload progress. On success, display detected schema (column names, types, row count). Allow renaming table before confirming. Use Tailwind styling. *(70cd992)*

### 1.7 DuckDB-WASM Query Engine (F003)

- [x] DUCK-01: Set up DuckDB-WASM — `frontend/src/services/duckdb.ts`. Initialize DuckDB-WASM with Web Worker. Configure OPFS or IndexedDB for persistence. Handle initialization errors gracefully. Write initialization test. *(cee1d85)*
- [x] DUCK-02: Create `useDuckDB` hook — `frontend/src/hooks/useDuckDB.ts`. Provides `query(sql)` function returning `{ columns, rows, duration }`. Handles loading state, errors. Manages single shared DuckDB instance via React context. *(3cef688)*
- [x] DUCK-03: Create data loading bridge — After file upload, fetch the file from backend and register it in DuckDB-WASM so client-side SQL works. Support loading Parquet directly, CSV via `read_csv_auto`. Add `loadTable(tableName, fileUrl)` to DuckDB service. *(3606cf7)*
- [x] DUCK-04: Write query execution tests — Test SQL queries against mock data loaded into DuckDB-WASM. Test SELECT, GROUP BY, aggregations, JOINs. Verify result shape matches expectations. *(e0791c9)*

### 1.8 Chart Library — Apache ECharts (F004)

- [x] CHART-01: Install ECharts and create base wrapper — `npm install echarts`. Create `frontend/src/components/charts/EChart.tsx` — a generic wrapper that takes an ECharts option object, manages resize, dispose lifecycle. Support Canvas and SVG rendering modes. Write render test.
- [x] CHART-02: Create Bar chart component — `frontend/src/components/charts/BarChart.tsx`. Props: data (array), xField, yField, title. Generates ECharts bar option. Supports horizontal/vertical. Write test with mock data.
- [x] CHART-03: Create Line and Area chart components — `LineChart.tsx` and `AreaChart.tsx`. Props: data, xField, yField, series (for multi-line). Support smooth lines, gradient fills for area. Write tests. *(8ddc75d)*
- [x] CHART-04: Create Scatter chart component — `ScatterChart.tsx`. Props: data, xField, yField, sizeField (optional), colorField (optional). Support tooltips showing all fields. Write test. *(e2f04e7)*
- [x] CHART-05: Create Pie/Donut chart component — `PieChart.tsx`. Props: data, nameField, valueField, donut (boolean). Support legend, percentage labels. Write test. *(f06f8eb)*
- [x] CHART-06: Create Radar chart component — `RadarChart.tsx`. Props: data (array of series), indicators (array of dimension names + max values), title. ECharts radar option with area fill. Write test. *(1cbe296)*
- [ ] CHART-07: Create KPI card component — `KPICard.tsx`. Props: title, value, unit, trend (up/down/flat), comparison text. Large number display with trend indicator. Pure Tailwind, no ECharts needed. Write test.
- [ ] CHART-08: Create Data Table component — `DataTable.tsx`. Props: columns, rows, sortable, pageSize. Pagination, column sorting, column resize. Tailwind-styled. Virtual scrolling for large datasets. Write test.

### 1.9 SQL Editor (F006)

- [ ] EDITOR-01: Install Monaco and create SQL editor — `npm install @monaco-editor/react`. Create `frontend/src/components/editor/SQLEditor.tsx` with SQL syntax highlighting, auto-completion for SQL keywords. Run button, keyboard shortcut (Ctrl+Enter). Write render test.
- [ ] EDITOR-02: Create schema explorer sidebar — `frontend/src/components/editor/SchemaExplorer.tsx`. Tree view showing: workspace tables and columns (with types). Click column name to insert into editor. Fetch schema from `GET /api/data/sources`.
- [ ] EDITOR-03: Create query result panel — `frontend/src/components/editor/QueryResult.tsx`. Tabs: Table view (using DataTable component) and Chart view (auto-suggest chart type from result shape). Show row count, query duration.
- [ ] EDITOR-04: Create SQL Editor page — `frontend/src/pages/EditorPage.tsx`. Layout: schema explorer (left sidebar), editor (top), results (bottom). Resizable panes. Execute query via `useDuckDB` hook.
- [ ] EDITOR-05: Add query history — Store last 50 queries in localStorage (queries only, no sensitive data). Show history dropdown in editor. Click to reload query. Timestamp each entry.

### 1.10 Dashboard Builder (F005)

- [ ] DASH-01: Install react-grid-layout and create dashboard grid — `npm install react-grid-layout`. Create `frontend/src/components/dashboard/DashboardGrid.tsx`. Drag-and-drop card placement. Responsive breakpoints. Save layout as JSON. Write render test.
- [ ] DASH-02: Create dashboard card wrapper — `frontend/src/components/dashboard/DashboardCard.tsx`. Card chrome: title bar, settings icon, remove button, resize handle. Content area renders child chart component. Drag handle in title bar.
- [ ] DASH-03: Create chart config dialog — `frontend/src/components/dashboard/ChartConfigDialog.tsx`. Modal for configuring a card: select chart type (bar, line, area, scatter, pie, radar, kpi, table), write/select SQL query, map columns to axes. Preview button.
- [ ] DASH-04: Create add-card flow — "Add Card" button on dashboard opens ChartConfigDialog. On confirm, creates new card with chosen chart + query. Card executes SQL via DuckDB-WASM and renders result.
- [ ] DASH-05: Create dashboard page — `frontend/src/pages/DashboardPage.tsx`. Load dashboard by ID from URL param. Render DashboardGrid with saved cards. Edit mode toggle (drag/resize enabled vs. view-only). Add card button in edit mode. Add text/markdown block option.

### 1.11 Interactive Filters (F007)

- [ ] FILTER-01: Create filter components — `frontend/src/components/dashboard/filters/`: `DateRangeFilter.tsx` (date picker), `DropdownFilter.tsx` (single select), `MultiSelectFilter.tsx` (checkbox list), `SearchFilter.tsx` (text input). Each emits filter value change. Write tests.
- [ ] FILTER-02: Create filter bar and context — `frontend/src/components/dashboard/FilterBar.tsx`. Horizontal bar above dashboard grid. Add/remove filters. `useFilters` hook with React context providing current filter values to all cards.
- [ ] FILTER-03: Wire filters to chart queries — Each dashboard card's SQL query supports `WHERE` clause injection from active filters. Parameterized queries (no SQL injection). Charts re-render when filters change.

### 1.12 Dashboard Persistence (F009)

- [ ] PERSIST-01: Create Dashboard model — `backend/models/dashboard.py` with id (UUID), workspace_id (FK), name, layout_json (JSONB for grid positions), cards_json (JSONB for chart configs + queries), filters_json (JSONB), created_at, updated_at. Create Alembic migration. Write model test.
- [ ] PERSIST-02: Create Dashboard API routes — `backend/api/dashboards.py` with `GET /api/dashboards` (list), `POST /api/dashboards` (create), `GET /api/dashboards/:id`, `PUT /api/dashboards/:id` (update layout/cards), `DELETE /api/dashboards/:id`. Scoped to workspace. Write pytest tests.
- [ ] PERSIST-03: Wire frontend save/load — Dashboard page loads from API on mount. Auto-save on layout change (debounced 2s). Save button for immediate save. Dashboard list page showing all dashboards with create/rename/delete.
- [ ] PERSIST-04: Dashboard export/import — `POST /api/dashboards/import` and `GET /api/dashboards/:id/export`. Export returns portable JSON file (layout + card configs, no data). Import creates new dashboard from JSON. Add export/import buttons in UI.

---

## Phase 2: Intelligence

> **Goal**: AI analysis, natural language to SQL, insight engine, deck generator, geo-visualization
> **Features**: F010, F010B, F011, F012, F013, F014, F014B, F014C, F014D

### 2.1 AI Text-to-SQL (F010)

- [ ] AI-01: Create AI service backend — `backend/services/ai_service.py`. Claude API client. `text_to_sql(question, schema, sample_rows)` method. Send schema + 50 sample rows as context. Return generated SQL. Write test with mocked API.
- [ ] AI-02: Create AI API routes — `backend/api/ai.py` with `POST /api/ai/text-to-sql` accepting question + workspace_id. Fetches schema from DuckDB, calls AI service, returns SQL + explanation. Write pytest tests.
- [ ] AI-03: Create natural language query input — `frontend/src/components/ai/NLQueryInput.tsx`. Text input with "Ask a question about your data..." placeholder. Submit sends to `/api/ai/text-to-sql`. Display generated SQL, allow editing before execution. Run via DuckDB-WASM.

### 2.2 Observable Plot — AI Exploratory Charts (F010B)

- [ ] PLOT-01: Install Observable Plot and create renderer — `npm install @observablehq/plot`. Create `frontend/src/components/explore/PlotRenderer.tsx`. Takes a Plot spec (JSON-serializable mark definitions) and renders using Plot.plot(). Write render test.
- [ ] PLOT-02: Create Plot spec generator on backend — Extend `ai_service.py` with `generate_plot_spec(question, query_result)`. Claude generates Observable Plot mark spec as JSON. Validate spec structure before returning. Write test.
- [ ] PLOT-03: Create "promote to dashboard" flow — Button on Plot charts to convert to ECharts dashboard card. Map Plot mark types to ECharts equivalents (barY to bar, dot to scatter, line to line). Add to dashboard grid.

### 2.3 AI Insight Engine (F011)

- [ ] INSIGHT-01: Create insight generation service — Extend `ai_service.py` with `generate_insights(schema, sample_data)`. Claude analyzes schema + sample to produce insight cards: trends, anomalies, correlations, outliers. Return as structured JSON array. Write test.
- [ ] INSIGHT-02: Create insight cards UI — `frontend/src/components/ai/InsightCard.tsx`. Card with title, description, severity (info/warning/important), optional mini-chart (Plot). `InsightPanel.tsx` lists all insights for current dataset.
- [ ] INSIGHT-03: Auto-generate insights on upload — After file upload + ingestion, trigger insight generation in background. Show loading spinner in insight panel. Cache results per table.

### 2.4 AI Chat Panel (F012)

- [ ] CHAT-01: Create chat API endpoint — `backend/api/ai.py` add `POST /api/ai/chat`. Accepts message + conversation history + workspace_id. Claude receives full schema context. Returns text + optional SQL + optional Plot spec. Write tests.
- [ ] CHAT-02: Create chat panel UI — `frontend/src/components/ai/ChatPanel.tsx`. Right sidebar (collapsible). Message bubbles (user/ralph). Input field at bottom. Conversation maintained per session in state. Ralph avatar with personality.
- [ ] CHAT-03: Render rich chat responses — Chat messages can contain: plain text, SQL code blocks (with "Run" button), Observable Plot charts (inline), data tables. Parse response structure and render appropriate components.

### 2.5 Deck Generator (F013)

- [ ] DECK-01: Create deck generation service — Extend `ai_service.py` with `generate_deck(schema, sample_data, user_goal)`. Claude produces a multi-slide analysis: title, key findings (each with chart spec + narrative), recommendations. Return structured JSON.
- [ ] DECK-02: Create deck viewer UI — `frontend/src/components/ai/DeckViewer.tsx`. Slide-based presentation view. Each slide renders text + Plot chart. Navigation arrows, slide counter. Fullscreen mode.
- [ ] DECK-03: Create one-click deck trigger — "Generate Analysis Deck" button on data source page and dashboard. Opens modal for optional focus prompt ("What should Ralph analyze?"). Shows generation progress. Opens DeckViewer on complete.

### 2.6 Data Quality Scoring (F014)

- [ ] QUALITY-01: Create data quality service — `backend/services/quality_service.py`. Scan table via DuckDB: null counts per column, duplicate rows, type consistency, outlier detection (IQR method). Return quality score (0-100) + issues list. Write tests.
- [ ] QUALITY-02: Create quality score card UI — `frontend/src/components/ai/QualityScoreCard.tsx`. Circular score gauge, issues breakdown (missing values, duplicates, type mismatches, outliers). Actionable suggestions (e.g., "Column X has 15% nulls").

### 2.7 Deck.gl Geo-Visualization (F014B, F014C, F014D)

- [ ] GEO-01: Install Deck.gl + MapLibre and create base map — `npm install deck.gl @deck.gl/react maplibre-gl`. Create `frontend/src/components/geo/BaseMap.tsx`. MapLibre base tiles (free, no API key). Deck.gl overlay. Zoom/pan controls. Write render test.
- [ ] GEO-02: Create ScatterplotLayer component — `frontend/src/components/geo/ScatterplotMap.tsx`. Props: data, latField, lonField, colorField, sizeField. Renders points on map. Tooltips on hover. Write test.
- [ ] GEO-03: Create HexagonLayer and HeatmapLayer — `HexagonMap.tsx` and `HeatmapMap.tsx`. Aggregate point data into hex bins or heatmap intensity. Configurable radius, color scale. Write tests.
- [ ] GEO-04: Create ArcLayer component — `ArcMap.tsx`. Props: data, originLat, originLon, destLat, destLon, colorField. Renders arcs between origin-destination pairs. Write test.
- [ ] GEO-05: Create GeoJsonLayer component — `GeoJsonMap.tsx`. Props: geojsonData, fillField, strokeField. Renders polygon/boundary data. Color by data value. Write test.
- [ ] GEO-06: Add map chart type to dashboard builder — Extend ChartConfigDialog with "Map" chart type. Sub-options: Scatterplot, Hexagon, Heatmap, Arc, GeoJson. Column mapping for lat/lon/value fields. Map card renders in dashboard grid.
- [ ] GEO-07: AI geo-column detection — Extend `ai_service.py` with `detect_geo_columns(schema, sample_rows)`. Claude identifies lat/lon pairs, country names, region codes. Auto-suggest map chart type when geo columns found. Write test.

---

## Phase 3: Voice

> **Goal**: Hey Ralph voice assistant — push-to-talk, wake word, spoken responses
> **Features**: F015, F016, F017, F018, F019

### 3.1 Voice Assistant Core (F015)

- [ ] VOICE-01: Create voice WebSocket proxy — `backend/api/voice.py` with WebSocket endpoint `/ws/voice`. Proxies audio stream to OpenAI Realtime API. Handles authentication. Streams response audio back. Write connection test.
- [ ] VOICE-02: Create `useVoice` hook — `frontend/src/hooks/useVoice.ts`. MediaStream API for microphone access. WebSocket connection to backend. Send audio chunks while recording. Receive and play response audio via Web Audio API.
- [ ] VOICE-03: Create push-to-talk UI — `frontend/src/components/voice/PushToTalk.tsx`. Hold-to-record button (microphone icon). Visual indicator: idle, recording (pulsing), processing (spinner), playing (waveform). Transcript shown below.

### 3.2 Wake Word Detection (F016)

- [ ] VOICE-04: Create wake word listener — `frontend/src/components/voice/WakeWordListener.tsx`. Uses Web Speech API for continuous speech recognition. Listens for "Hey Ralph" phrase. When detected, activates voice recording automatically. Toggle on/off setting.
- [ ] VOICE-05: Create voice status indicator — Persistent UI element showing: wake word listening (ear icon), voice active (microphone icon), processing, speaking. Placed in top bar or floating corner.

### 3.3 Voice Command Routing (F017)

- [ ] VOICE-06: Create intent classifier — Extend `backend/services/ai_service.py` with `classify_voice_intent(transcript)`. Categories: query (data question), filter (change dashboard filter), export (download data), narrate (read dashboard aloud), navigate (go to page). Write tests.
- [ ] VOICE-07: Wire voice to data queries — When intent=query: send transcript to text-to-SQL pipeline, execute SQL via DuckDB, render chart, speak summary of results. End-to-end integration.

### 3.4 Dashboard Narration (F018)

- [ ] VOICE-08: Create narration service — Extend AI service with `narrate_dashboard(dashboard_config, query_results)`. Claude generates spoken narrative per chart: what it shows, key takeaways, recommendations. Return as text segments.
- [ ] VOICE-09: Create narration playback — Use OpenAI TTS API (streaming) to convert narration text to speech. Play chart-by-chart with visual highlighting of current chart. Pause/resume controls.

### 3.5 Voice Transcript Panel (F019)

- [ ] VOICE-10: Create transcript panel — `frontend/src/components/voice/TranscriptPanel.tsx`. Rolling list of voice interactions: timestamp, user speech (transcribed), Ralph response. Click past query to re-run. Copy transcript. Search within history.

---

## Phase 4: Connectivity

> **Goal**: Live data sources, n8n pipelines, scheduled refresh, alerts, export
> **Features**: F020, F021, F022, F023, F024

### 4.1 n8n Webhook Integration (F020)

- [ ] WEBHOOK-01: Create webhook API — `backend/api/n8n.py` with `POST /api/webhooks/:workspace_id/ingest`. Accepts JSON payload, validates against expected schema, ingests into DuckDB table. API key auth (separate from JWT). Write tests.
- [ ] WEBHOOK-02: Create webhook config UI — Settings page to view webhook URL, generate/rotate API key, configure target table mapping. Show recent webhook events with status.

### 4.2 Database Connectors (F021)

- [ ] CONN-01: Create connection service — `backend/services/connection_service.py`. Connect to external PostgreSQL, MySQL, SQLite. Test connection. List tables. Execute read-only query. Store connection config encrypted in PostgreSQL. Write tests.
- [ ] CONN-02: Create connection UI — Settings page for adding database connections. Connection form (type, host, port, user, password, database). Test connection button. Browse external tables. Import query results into workspace DuckDB.

### 4.3 Scheduled Refresh (F022)

- [ ] SCHED-01: Create scheduler service — `backend/services/scheduler_service.py`. APScheduler or similar. Define refresh jobs per data source (cron expression). Re-run webhook ingestion or database query on schedule. Store last refresh timestamp.
- [ ] SCHED-02: Create schedule config UI — Per data source: enable/disable refresh, set cron schedule (presets: hourly, daily, weekly + custom). Show last refresh time and next scheduled run on dashboard.

### 4.4 Alert Engine (F023)

- [ ] ALERT-01: Create Alert model and service — `backend/models/alert.py` with id, workspace_id, name, query (SQL), condition (gt/lt/eq), threshold, channel (browser/email/webhook). `backend/services/alert_service.py` evaluates alerts on schedule. Write tests.
- [ ] ALERT-02: Create alert config UI — Alert management page. Create alert: name, SQL query, condition, threshold value, notification channel. List active alerts with status (OK/triggered). History of trigger events.
- [ ] ALERT-03: Create alert notification delivery — Browser push notifications (Notification API). Email via SMTP (configurable). n8n webhook callback. Triggered alert updates status and logs event.

### 4.5 Export Engine (F024)
- [ ] EXPORT-01: Create export service — `backend/services/export_service.py`. Export dashboard as PDF (using weasyprint or similar). Individual charts as PNG/SVG (ECharts built-in export). Data as CSV or Excel (openpyxl). Write tests.
- [ ] EXPORT-02: Create export UI — Export button on dashboard: "Export as PDF", "Export data as CSV/Excel". Per-chart export menu: "Download as PNG", "Download as SVG". Download triggers backend export endpoint.

---

## Task Summary

| Phase | Section | Tasks |
|-------|---------|-------|
| 1 | 1.0 Legacy Cleanup | 1 |
| 1 | 1.1 Project Setup & Docker | 7 |
| 1 | 1.2 Backend Scaffold | 3 |
| 1 | 1.3 Frontend Scaffold | 3 |
| 1 | 1.4 User Authentication | 5 |
| 1 | 1.5 Workspace Model | 2 |
| 1 | 1.6 File Ingestion | 5 |
| 1 | 1.7 DuckDB-WASM Query Engine | 4 |
| 1 | 1.8 Chart Library | 8 |
| 1 | 1.9 SQL Editor | 5 |
| 1 | 1.10 Dashboard Builder | 5 |
| 1 | 1.11 Interactive Filters | 3 |
| 1 | 1.12 Dashboard Persistence | 4 |
| **1 total** | | **55** |
| 2 | 2.1 AI Text-to-SQL | 3 |
| 2 | 2.2 Observable Plot | 3 |
| 2 | 2.3 AI Insight Engine | 3 |
| 2 | 2.4 AI Chat Panel | 3 |
| 2 | 2.5 Deck Generator | 3 |
| 2 | 2.6 Data Quality Scoring | 2 |
| 2 | 2.7 Geo-Visualization | 7 |
| **2 total** | | **24** |
| 3 | 3.1-3.5 Voice | 10 |
| **3 total** | | **10** |
| 4 | 4.1-4.5 Connectivity | 11 |
| **4 total** | | **11** |
| **Grand total** | | **100** |

---

## Dependency Graph (Critical Path)

```
CLEANUP-01 → SETUP-01 → SETUP-02..07 (parallel)
                       → API-01 → API-02 → API-03
                       → UI-01 → UI-02 → UI-03
                                         → AUTH-04, AUTH-05
             API-03 → AUTH-01 → AUTH-02 → AUTH-03
             AUTH-01 + AUTH-03 → DB-01 → DB-02
             DB-02 → DATA-01 → DATA-02 → DATA-03 → DATA-04
             UI-01 → DUCK-01 → DUCK-02 → DUCK-03 → DUCK-04
             DATA-05 depends on DATA-04 + UI-02
             DUCK-02 → CHART-01 → CHART-02..08 (parallel)
             CHART-08 → EDITOR-01..05 (sequential)
             CHART-01..08 + DUCK-02 → DASH-01..05 (sequential)
             DASH-05 → FILTER-01..03 (sequential)
             DASH-05 + API-03 → PERSIST-01..04 (sequential)
```

---

## Blockers

- None currently.

---

## Notes

- **Gap analysis (2026-02-23)**: Full codebase scan confirmed plan accuracy. 358 legacy HazOp files remain. 48 conflict markers across 6 files. Zero find.bi source code exists.
- **Merge status**: Git merge is complete (`cc358a4`). No UU/AA conflicts in index. However, 6 files have `<<<<<<<` conflict markers committed into their content: `README.md` (6 markers/2 blocks), `QUICKSTART.md` (3/1), `PROMPT_Build.md` (6/2), `setup_project.sh` (9/3), `setup_project.ps1` (21/7), `.claude/settings.local.json` (3/1). These were merged but markers were left in the file content.
- **Already clean files**: `PRD.json`, `CLAUDE.md` — contain no conflict markers. PRD.json has correct find.bi content. `loop.ps1` is modified in working directory but has no conflict markers.
- **Auto-generated files**: `ralph_log_*.txt` and `ralph_log_*.md` exist at root from Ralph loop runs. These should be gitignored (added in CLEANUP-01).
- **Old HazOp code** exists throughout the repo: `apps/` (288 files — NestJS API + React web), `packages/` (20 files — types+utils), `migrations/` (16 files), `e2e/` (10 files), `docs/` (2 files), `docker/` (14 files — grafana/loki/prometheus/nginx configs), `scripts/` (7 files). Root has 9 HazOp utility scripts. Conflict markers also exist in legacy files but those entire directories get deleted by CLEANUP-01.
- **docker-compose.yml** currently runs 7 HazOp services (PostgreSQL, Redis, MinIO, RabbitMQ, Prometheus, Loki, Grafana). SETUP-02 replaces with just PostgreSQL.
- **.env.example** currently has HazOp config (`DB_USER=hazop`, `DB_NAME=hazop`, MinIO, RabbitMQ vars). SETUP-03 replaces with find.bi config.
- **.gitignore** lines 1-4 reference "CRM runtime" and lacks find.bi paths (`backend/`, `frontend/`, DuckDB, `.claude/settings.local.json`, `ralph_log_*`).
- **CLAUDE.md** describes find.bi project correctly — no changes needed.
- **No find.bi source code exists yet** — `frontend/` and `backend/` directories don't exist. Critical path: CLEANUP-01 → SETUP-01 → API-01/UI-01 before any feature work.
- **specs/** directory contains only a README template — no actual specs. PRD.json is sufficient for this project.
- **Personality/Easter eggs** (Ralph Wiggum quotes, 404 page, loading messages) are documented in CLAUDE.md but deliberately deferred. Add after Phase 1 core is working — not tracked as tasks.
- The PRD defines Radar chart type — added as CHART-06.
- DASH-03 and DASH-05 include radar chart type and text/markdown blocks.
- **Keep list for CLEANUP-01**: Ralph loop infrastructure (`AGENTS.md`, `findbi.code-workspace`, `hooks/`, `loop.*`, `evaluate_loop.ps1`, `check_prompt_injection.ps1`, `PROMPT_*.md`, `specs/`, `setup_project.*`, `.claude/`) must be preserved during cleanup.
- **PRD coverage audit**: All 24 features (F001–F024) are mapped to plan tasks. No gaps found.

---

## Completed Tasks Log

| Task | Commit | Date |
|------|--------|------|
| CLEANUP-01 | c8de093 + 783b7a9 | 2026-02-23 |
| SETUP-01 | c3757d8 | 2026-02-23 |
| SETUP-02 | 8f7a2c0 | 2026-02-23 |
| SETUP-03 | e65a7f1 | 2026-02-23 |
| SETUP-04 | 08c08aa | 2026-02-23 |
| SETUP-05 | a00b4f0 | 2026-02-23 |
| SETUP-06 | 7baa760 | 2026-02-23 |
| SETUP-07 | 357fe2a | 2026-02-23 |
| API-01 | 635b434 | 2026-02-23 |
| API-02 | a088785 | 2026-02-23 |
| API-03 | 9576126 | 2026-02-23 |
| UI-01 | 3e9dbf9 | 2026-02-23 |
| UI-02 | 25344eb | 2026-02-23 |
| UI-03 | b0f2efa | 2026-02-23 |
| AUTH-01 | 8700aa3 | 2026-02-23 |
| AUTH-02 | 20c1800 | 2026-02-23 |
| AUTH-03 | e5e38a4 | 2026-02-23 |
| AUTH-04 | ab0c56a | 2026-02-23 |
| AUTH-05 | f9f66b3 | 2026-02-23 |
| DB-01 | 577f103 | 2026-02-23 |
| DB-02 | 7a05f1e | 2026-02-23 |
| DATA-01 | 612cb18 | 2026-02-23 |
| DATA-02 | 1905d1c | 2026-02-23 |
| DATA-03 | 7d92f26 | 2026-02-23 |
| DATA-04 | 3d0d21b | 2026-02-23 |
| DATA-05 | 70cd992 | 2026-02-23 |
| DUCK-01 | cee1d85 | 2026-02-23 |
| DUCK-02 | 3cef688 | 2026-02-23 |
| DUCK-03 | 3606cf7 | 2026-02-23 |
| DUCK-04 | e0791c9 | 2026-02-23 |
| CHART-01 | ae0bbdc | 2026-02-23 |
| CHART-02 | 5702ee7 | 2026-02-23 |
| CHART-03 | 8ddc75d | 2026-02-23 |
| CHART-04 | e2f04e7 | 2026-02-23 |
| CHART-05 | f06f8eb | 2026-02-23 |
| CHART-06 | 1cbe296 | 2026-02-23 |
