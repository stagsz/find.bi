# Implementation Plan - HazOp Assistant

> **Ralph Workflow**: Do tasks in order. One at a time. Update this file after each commit.

## Current Status

**Phase**: 3 - Project Management
**Progress**: PROJ-06 complete
**Last Completed**: PROJ-06 - Create POST /projects/:id/members endpoint (01f8bb8)
**Next Task**: PROJ-07 - Create DELETE /projects/:id/members/:userId endpoint (remove member)

---

## Gap Analysis Summary

This is a **greenfield project** - no existing implementation. The HazOp Assistant needs to be built from scratch based on:
- **PRD.json**: Product requirements for industrial HazOps methodology automation
- **architecture.md**: Technical architecture with Docker Compose, React/TypeScript frontend, Node.js/Express backend, PostgreSQL database

**Key Deliverables:**
1. P&ID document upload and processing system
2. Guided HazOps analysis workflow with guide words
3. Risk assessment with severity × likelihood × detectability matrices
4. LOPA (Layers of Protection Analysis) validation
5. Regulatory compliance validation (IEC 61511, ISO 31000, OSHA PSM, etc.)
6. Professional report generation (Word, PDF, Excel, PowerPoint)

**PRD Functional Requirements Coverage:**
| Requirement | Description | Phase | Tasks |
|-------------|-------------|-------|-------|
| FR1 | P&ID interpretation and analysis | Phase 4 | PID-01 to PID-21 |
| FR2 | Guide word analysis workflow | Phase 5 | HAZOP-01 to HAZOP-30 |
| FR3 | Prepared answer menus | Phase 5 | HAZOP-03 to HAZOP-06 |
| FR4 | Auto-populate analysis tables | Phase 5 | HAZOP-27 |
| FR5 | Risk ranking methodology | Phase 6 | RISK-01 to RISK-16 |
| FR6 | LOPA validation | Phase 7 | LOPA-01 to LOPA-04 |
| FR7 | Regulatory compliance | Phase 7 | COMP-01 to COMP-19 |
| FR8 | Report generation (Word/PDF/Excel/PPT) | Phase 9 | REPORT-01 to REPORT-21 |
| FR9 | Structured workflow | Phases 5-7 | Integrated across phases |

**Architecture Alignment:**
- ✅ Monorepo: Nx with apps/web, apps/api, packages/types, packages/utils
- ✅ Frontend: React 18 + TypeScript + Vite + Tailwind + Mantine
- ✅ Backend: Node.js 20.x + Express.js + TypeScript
- ✅ Database: PostgreSQL 15+ with Redis cache
- ✅ Storage: MinIO (S3-compatible) for P&ID documents
- ✅ Real-time: Socket.io for collaboration
- ✅ Queue: RabbitMQ for async report generation
- ✅ Testing: Vitest (FE), Jest (BE), Playwright (E2E)

---

## Phase 1: Foundation & Infrastructure

### Project Setup
- [x] SETUP-01: Initialize Nx monorepo with apps (web, api) and shared packages (types, utils)
- [x] SETUP-02: Configure Docker Compose for development (PostgreSQL, Redis, MinIO, RabbitMQ)
- [x] SETUP-03: Set up React 18 + TypeScript + Vite in web app (dc838a8 - included in SETUP-01)
- [x] SETUP-04: Set up Express.js + TypeScript in api app (dc838a8 - included in SETUP-01)
- [x] SETUP-05: Configure Tailwind CSS and Mantine UI component library (8ffe440)
- [x] SETUP-06: Set up Vitest for frontend testing (03ed071)
- [x] SETUP-07: Set up Jest + Supertest for API testing (4c15fcf)
- [x] SETUP-08: Configure Playwright for E2E testing (15a2d04)
- [x] SETUP-09: Set up ESLint + Prettier for code quality (e2a674a)

### Shared Types Package
- [x] TYPES-01: Create User, UserRole type definitions (a77cd57)
- [x] TYPES-02: Create Project, ProjectStatus type definitions (bcf10dc)
- [x] TYPES-03: Create PIDDocument type definitions (4f1c83e)
- [x] TYPES-04: Create AnalysisNode, EquipmentType type definitions (8fde62f)
- [x] TYPES-05: Create HazopsAnalysis, GuideWord, RiskRanking type definitions (0f10b5c)
- [x] TYPES-06: Create Report, ReportRequest type definitions (fb99a7d)
- [x] TYPES-07: Create API request/response type definitions (eeb81c5)

### Database Setup
- [x] DB-01: Create PostgreSQL schema with custom enum types (user_role, project_status, etc.) (977df3c)
- [x] DB-02: Create users table with password_hash, role, organization (14437cf)
- [x] DB-03: Create projects and project_members tables (3d517f7)
- [x] DB-04: Create pid_documents table with processing_status (5aa6df5)
- [x] DB-05: Create analysis_nodes table with equipment_type and coordinates (288e8a9)
- [x] DB-06: Create hazop_analyses and analysis_entries tables (138ddb4)
- [x] DB-07: Create collaboration_sessions and session_participants tables (bae521e)
- [x] DB-08: Create audit_log table for change tracking (ee49495)
- [x] DB-09: Create reports and report_templates tables (b9de3bd)
- [x] DB-10: Add performance indexes for all tables (b3ca5da)
- [x] DB-11: Create database triggers for updated_at timestamps (4cae1e7)

---

## Phase 2: Authentication & User Management

### Backend Auth
- [x] AUTH-01: Implement JWT token generation with RS256 (access + refresh tokens) (ace7d5e)
- [x] AUTH-02: Create Passport.js authentication strategy (c1e04c2)
- [x] AUTH-03: Create POST /auth/register endpoint (3b648bc)
- [x] AUTH-04: Create POST /auth/login endpoint (bd0f7ae)
- [x] AUTH-05: Create POST /auth/refresh endpoint (1d12302)
- [x] AUTH-06: Create POST /auth/logout endpoint (da49b35)
- [x] AUTH-07: Create auth middleware for protected routes (325d01c)
- [x] AUTH-08: Implement role-based access control (admin, lead_analyst, analyst, viewer) (af11d4f)

### Frontend Auth
- [x] AUTH-09: Create auth store with Zustand (user state, tokens) (de6fb38)
- [x] AUTH-10: Create login page with email/password form (bf0aa75)
- [x] AUTH-11: Create registration page with role selection (615cb4e)
- [x] AUTH-12: Create password reset flow (forgot password page) (041b7f5)
- [x] AUTH-13: Implement auth guards for protected routes (7c9e7c4)
- [x] AUTH-14: Create user profile page with edit functionality (1a1e187)

### Auth Testing
- [x] AUTH-15: Add unit tests for JWT token generation/validation (fac9c60)
- [x] AUTH-16: Add API tests for auth endpoints (5f48429)
- [x] AUTH-17: Add E2E tests for login/logout flow (b5a233d)

### Admin User Management (Administrator Role Only)
- [x] ADMIN-01: Create GET /admin/users endpoint (list all users with search/filter) (31b1001)
- [x] ADMIN-02: Create PUT /admin/users/:id/role endpoint (change user role) (1d9e2fd)
- [x] ADMIN-03: Create PUT /admin/users/:id/status endpoint (activate/deactivate user) (da37825)
- [x] ADMIN-04: Create admin user management page with data table (e06d280)
- [x] ADMIN-05: Create user role editor modal (e352dad)
- [x] ADMIN-06: Add admin route guard (restrict to administrator role) (bb1c50c)
- [x] ADMIN-07: Add API tests for admin endpoints (7d3c1af)

---

## Phase 3: Project Management

### Backend API
- [x] PROJ-01: Create GET /projects endpoint (list user projects with pagination) (045b495)
- [x] PROJ-02: Create POST /projects endpoint (create new project) (fd5de9a)
- [x] PROJ-03: Create GET /projects/:id endpoint (project details) (c5a9f6f)
- [x] PROJ-04: Create PUT /projects/:id endpoint (update project) (ceda9af)
- [x] PROJ-05: Create DELETE /projects/:id endpoint (archive project) (28765eb)
- [x] PROJ-06: Create POST /projects/:id/members endpoint (invite team member) (01f8bb8)
- [ ] PROJ-07: Create DELETE /projects/:id/members/:userId endpoint (remove member)

### Frontend UI
- [ ] PROJ-08: Create projects list page with status filters
- [ ] PROJ-09: Create project card component with status badge
- [ ] PROJ-10: Create new project form modal
- [ ] PROJ-11: Create project detail page with tabs (Overview, Documents, Analysis, Team)
- [ ] PROJ-12: Create team management panel (add/remove members)
- [ ] PROJ-13: Create project settings form (name, description, status)

### Project Testing
- [ ] PROJ-14: Add API tests for project CRUD endpoints
- [ ] PROJ-15: Add E2E tests for project creation workflow

---

## Phase 4: P&ID Document Management

### File Storage Service
- [ ] PID-01: Configure MinIO client for S3-compatible storage
- [ ] PID-02: Create file upload middleware with validation (PDF, PNG, JPG, DWG)
- [ ] PID-03: Create file retrieval service with signed URLs

### Backend API
- [ ] PID-04: Create POST /projects/:id/documents endpoint (upload P&ID)
- [ ] PID-05: Create GET /projects/:id/documents endpoint (list documents)
- [ ] PID-06: Create GET /documents/:id endpoint (document details)
- [ ] PID-07: Create DELETE /documents/:id endpoint (delete document)
- [ ] PID-08: Create GET /documents/:id/download endpoint (download original)

### P&ID Processing Service
- [ ] PID-09: Create basic P&ID metadata extraction (dimensions, file info)
- [ ] PID-10: Create manual node creation endpoint POST /documents/:id/nodes
- [ ] PID-11: Create node listing endpoint GET /documents/:id/nodes
- [ ] PID-12: Create node update endpoint PUT /nodes/:id
- [ ] PID-13: Create node delete endpoint DELETE /nodes/:id

### Frontend UI
- [ ] PID-14: Create P&ID upload component with drag-and-drop
- [ ] PID-15: Create document list view with thumbnails
- [ ] PID-16: Create P&ID viewer component (zoom, pan functionality)
- [ ] PID-17: Create node overlay component (clickable markers on P&ID)
- [ ] PID-18: Create node creation form (node ID, description, equipment type)
- [ ] PID-19: Create node editing modal

### P&ID Testing
- [ ] PID-20: Add API tests for document upload/retrieval
- [ ] PID-21: Add E2E tests for P&ID upload workflow

---

## Phase 5: Core HazOps Analysis Workflow (Epic 2)

### Analysis Engine Service
- [ ] HAZOP-01: Create HazOps analysis session service
- [ ] HAZOP-02: Implement guide word definitions (No, More, Less, Reverse, Early, Late, Other than)
- [ ] HAZOP-03: Create prepared answer menus for causes (configurable templates)
- [ ] HAZOP-04: Create prepared answer menus for consequences
- [ ] HAZOP-05: Create prepared answer menus for safeguards
- [ ] HAZOP-06: Create prepared answer menus for recommendations

### Backend API
- [ ] HAZOP-07: Create POST /projects/:id/analyses endpoint (create analysis session)
- [ ] HAZOP-08: Create GET /projects/:id/analyses endpoint (list analysis sessions)
- [ ] HAZOP-09: Create GET /analyses/:id endpoint (analysis session details)
- [ ] HAZOP-10: Create PUT /analyses/:id endpoint (update analysis metadata)
- [ ] HAZOP-11: Create POST /analyses/:id/entries endpoint (create analysis entry for node/guideword)
- [ ] HAZOP-12: Create GET /analyses/:id/entries endpoint (list all entries)
- [ ] HAZOP-13: Create PUT /entries/:id endpoint (update analysis entry)
- [ ] HAZOP-14: Create DELETE /entries/:id endpoint (delete analysis entry)
- [ ] HAZOP-15: Create POST /analyses/:id/complete endpoint (finalize analysis)

### Frontend Analysis Workspace
- [ ] HAZOP-16: Create analysis session list page with status indicators
- [ ] HAZOP-17: Create new analysis session wizard (select P&ID, name, methodology)
- [ ] HAZOP-18: Create analysis workspace layout (split-pane: P&ID viewer + analysis panel)
- [ ] HAZOP-19: Create node selection component (click node on P&ID to select)
- [ ] HAZOP-20: Create guide word selector (tab or dropdown navigation)
- [ ] HAZOP-21: Create deviation input form with autocomplete
- [ ] HAZOP-22: Create causes input with prepared answer menu (multi-select)
- [ ] HAZOP-23: Create consequences input with prepared answer menu (multi-select)
- [ ] HAZOP-24: Create safeguards input with prepared answer menu (multi-select)
- [ ] HAZOP-25: Create recommendations input with prepared answer menu (multi-select)
- [ ] HAZOP-26: Create analysis progress tracker (nodes completed/total)
- [ ] HAZOP-27: Create analysis entry summary table

### HazOps Testing
- [ ] HAZOP-28: Add unit tests for guide word validation logic
- [ ] HAZOP-29: Add API tests for analysis CRUD endpoints
- [ ] HAZOP-30: Add E2E tests for complete analysis workflow

---

## Phase 6: Risk Assessment (Epic 3 - Part 1)

### Risk Calculation Engine
- [ ] RISK-01: Create severity × likelihood × detectability calculation service
- [ ] RISK-02: Implement 5x5 risk matrix logic (Low, Medium, High mapping)
- [ ] RISK-03: Create risk level threshold configuration
- [ ] RISK-04: Implement risk score aggregation for analysis sessions

### Backend API
- [ ] RISK-05: Create PUT /entries/:id/risk endpoint (update risk ranking)
- [ ] RISK-06: Create GET /analyses/:id/risk-summary endpoint (aggregated risk view)
- [ ] RISK-07: Create GET /projects/:id/risk-dashboard endpoint (project-level risk metrics)

### Frontend Risk Assessment
- [ ] RISK-08: Create severity dropdown selector (1-5 scale with descriptions)
- [ ] RISK-09: Create likelihood dropdown selector (1-5 scale with descriptions)
- [ ] RISK-10: Create detectability dropdown selector (1-5 scale with descriptions)
- [ ] RISK-11: Create risk score display component (color-coded badge)
- [ ] RISK-12: Create interactive 5x5 risk matrix visualization
- [ ] RISK-13: Create risk dashboard page with charts and metrics
- [ ] RISK-14: Add risk filtering to analysis entry table

### Risk Testing
- [ ] RISK-15: Add unit tests for risk calculation logic
- [ ] RISK-16: Add API tests for risk endpoints

---

## Phase 7: LOPA & Compliance (Epic 3 - Part 2)

### LOPA Analysis Service
- [ ] LOPA-01: Create LOPA calculation engine (target mitigated event likelihood)
- [ ] LOPA-02: Implement independent protection layer (IPL) validation
- [ ] LOPA-03: Create LOPA recommendation trigger (when risk exceeds threshold)
- [ ] LOPA-04: Implement risk reduction factor calculation

### Regulatory Compliance Service
- [ ] COMP-01: Create regulatory standards database (IEC 61511, ISO 31000, ISO 9001)
- [ ] COMP-02: Add ATEX/DSEAR compliance checks
- [ ] COMP-03: Add PED (Pressure Equipment Directive) compliance checks
- [ ] COMP-04: Add OSHA PSM compliance checks
- [ ] COMP-05: Add EPA compliance checks
- [ ] COMP-06: Add SEVESO III directive compliance checks
- [ ] COMP-07: Create compliance validation engine (cross-reference findings)

### Backend API
- [ ] COMP-08: Create POST /entries/:id/lopa endpoint (create LOPA analysis)
- [ ] COMP-09: Create GET /entries/:id/lopa endpoint (get LOPA results)
- [ ] COMP-10: Create GET /projects/:id/compliance endpoint (compliance status)
- [ ] COMP-11: Create GET /analyses/:id/compliance endpoint (analysis compliance report)

### Frontend Compliance UI
- [ ] COMP-12: Create LOPA input form (initiating event, IPLs, target frequency)
- [ ] COMP-13: Create LOPA results display (gap analysis, recommendations)
- [ ] COMP-14: Create compliance validation screen with checklist view
- [ ] COMP-15: Create compliance status badges for analyses
- [ ] COMP-16: Create compliance dashboard with standard-by-standard breakdown

### Compliance Testing
- [ ] COMP-17: Add unit tests for LOPA calculations
- [ ] COMP-18: Add unit tests for compliance validation logic
- [ ] COMP-19: Add API tests for compliance endpoints

---

## Phase 8: Real-time Collaboration

### WebSocket Service
- [ ] COLLAB-01: Set up Socket.io server with authentication
- [ ] COLLAB-02: Create collaboration room management (create, join, leave)
- [ ] COLLAB-03: Implement real-time analysis entry updates broadcast
- [ ] COLLAB-04: Implement cursor position sharing
- [ ] COLLAB-05: Create conflict detection for concurrent edits

### Backend API
- [ ] COLLAB-06: Create POST /analyses/:id/collaborate endpoint (start session)
- [ ] COLLAB-07: Create GET /analyses/:id/collaborate endpoint (get active sessions)
- [ ] COLLAB-08: Create POST /analyses/:id/invite endpoint (send invitation)
- [ ] COLLAB-09: Create POST /sessions/:id/join endpoint (join collaboration)

### Frontend Collaboration
- [ ] COLLAB-10: Create useWebSocket hook for real-time updates
- [ ] COLLAB-11: Create collaboration status indicator (active users shown)
- [ ] COLLAB-12: Create user presence avatars on analysis workspace
- [ ] COLLAB-13: Create real-time entry update animations
- [ ] COLLAB-14: Create conflict resolution modal

### Collaboration Testing
- [ ] COLLAB-15: Add unit tests for WebSocket event handlers
- [ ] COLLAB-16: Add E2E tests for collaboration workflow

---

## Phase 9: Report Generation (Epic 4)

### Report Generation Service
- [ ] REPORT-01: Set up RabbitMQ for async report generation queue
- [ ] REPORT-02: Create Word document generator (docx format)
- [ ] REPORT-03: Create PDF document generator
- [ ] REPORT-04: Create Excel spreadsheet generator (analysis data tables)
- [ ] REPORT-05: Create PowerPoint presentation generator
- [ ] REPORT-06: Create risk matrix image generator
- [ ] REPORT-07: Create report template management service

### Backend API
- [ ] REPORT-08: Create POST /projects/:id/reports endpoint (request report generation)
- [ ] REPORT-09: Create GET /reports/:id/status endpoint (check generation status)
- [ ] REPORT-10: Create GET /reports/:id/download endpoint (download generated report)
- [ ] REPORT-11: Create GET /projects/:id/reports endpoint (list generated reports)
- [ ] REPORT-12: Create GET /templates endpoint (list available templates)

### Frontend Report UI
- [ ] REPORT-13: Create report generation center page
- [ ] REPORT-14: Create report request form (format, template, options)
- [ ] REPORT-15: Create report generation progress indicator
- [ ] REPORT-16: Create report preview component
- [ ] REPORT-17: Create reports list with download links
- [ ] REPORT-18: Create template selector with preview

### Report Testing
- [ ] REPORT-19: Add unit tests for each report format generator
- [ ] REPORT-20: Add API tests for report generation endpoints
- [ ] REPORT-21: Add E2E tests for full report generation workflow

---

## Phase 10: Dashboard & Navigation

### Frontend Dashboard
- [ ] DASH-01: Create main dashboard page layout
- [ ] DASH-02: Create project summary cards (active, completed, draft)
- [ ] DASH-03: Create recent analyses widget
- [ ] DASH-04: Create risk overview chart (distribution across projects)
- [ ] DASH-05: Create pending actions widget (analyses needing review)
- [ ] DASH-06: Create activity timeline widget

### Navigation & Layout
- [ ] NAV-01: Create main navigation sidebar with icons
- [ ] NAV-02: Create breadcrumb navigation component
- [ ] NAV-03: Create responsive layout (desktop primary, tablet support)
- [ ] NAV-04: Create dark mode toggle with theme persistence
- [ ] NAV-05: Create user menu dropdown (profile, settings, logout)
- [ ] NAV-06: Create notification dropdown for system alerts

---

## Phase 11: Polish & Deployment

### Performance & UX
- [ ] PERF-01: Add loading skeletons to all data-fetching components
- [ ] PERF-02: Implement error boundaries with fallback UI
- [ ] PERF-03: Add toast notifications for success/error feedback
- [ ] PERF-04: Implement optimistic updates for analysis entries
- [ ] PERF-05: Add keyboard shortcuts for common analysis actions

### Monitoring & Logging
- [ ] OPS-01: Set up Prometheus metrics collection
- [ ] OPS-02: Configure Grafana dashboards
- [ ] OPS-03: Set up Winston structured logging
- [ ] OPS-04: Configure Loki log aggregation

### Docker & Deployment
- [ ] DEPLOY-01: Create production Docker Compose configuration
- [ ] DEPLOY-02: Create Nginx reverse proxy configuration
- [ ] DEPLOY-03: Configure production environment variables
- [ ] DEPLOY-04: Set up GitHub Actions CI/CD pipeline
- [ ] DEPLOY-05: Create database migration scripts for production
- [ ] DEPLOY-06: Add health check endpoints for all services

### Documentation
- [ ] DOCS-01: Create API documentation with OpenAPI/Swagger
- [ ] DOCS-02: Update README with setup and deployment instructions
- [ ] DOCS-03: Create environment variable documentation
- [ ] DOCS-04: Create user guide for HazOps analysis workflow

---

## Blockers

_No blockers currently._

---

## Completed Tasks Log

| Task | Commit | Date |
|------|--------|------|
| Initial planning | - | 2026-02-09 |
| SETUP-01: Initialize Nx monorepo | dc838a8 | 2026-02-09 |
| SETUP-02: Configure Docker Compose | 3119b77 | 2026-02-09 |
| SETUP-03: React 18 + TypeScript + Vite | dc838a8 | 2026-02-09 |
| SETUP-04: Express.js + TypeScript | dc838a8 | 2026-02-09 |
| SETUP-05: Tailwind CSS + Mantine UI | 8ffe440 | 2026-02-09 |
| SETUP-06: Vitest frontend testing | 03ed071 | 2026-02-09 |
| SETUP-07: Jest + Supertest API testing | 4c15fcf | 2026-02-09 |
| SETUP-08: Playwright E2E testing | 15a2d04 | 2026-02-09 |
| SETUP-09: ESLint + Prettier code quality | e2a674a | 2026-02-09 |
| TYPES-01: User, UserRole type definitions | a77cd57 | 2026-02-09 |
| TYPES-02: Project, ProjectStatus type definitions | bcf10dc | 2026-02-09 |
| TYPES-03: PIDDocument type definitions | 4f1c83e | 2026-02-09 |
| TYPES-04: AnalysisNode, EquipmentType type definitions | 8fde62f | 2026-02-09 |
| TYPES-05: HazopsAnalysis, GuideWord, RiskRanking types | 0f10b5c | 2026-02-09 |
| TYPES-06: Report, ReportRequest type definitions | fb99a7d | 2026-02-09 |
| TYPES-07: API request/response type definitions | eeb81c5 | 2026-02-09 |
| DB-01: PostgreSQL schema with custom enum types | 977df3c | 2026-02-09 |
| DB-02: Create users table migration | 14437cf | 2026-02-09 |
| DB-03: Create projects and project_members tables | 3d517f7 | 2026-02-09 |
| DB-04: Create pid_documents table | 5aa6df5 | 2026-02-09 |
| DB-05: Create analysis_nodes table | 288e8a9 | 2026-02-09 |
| DB-06: Create hazop_analyses and analysis_entries tables | 138ddb4 | 2026-02-09 |
| DB-07: Create collaboration_sessions and session_participants tables | bae521e | 2026-02-09 |
| DB-08: Create audit_log table for change tracking | ee49495 | 2026-02-09 |
| DB-09: Create reports and report_templates tables | b9de3bd | 2026-02-09 |
| DB-10: Add performance indexes for all tables | b3ca5da | 2026-02-09 |
| DB-11: Create database triggers for updated_at timestamps | 4cae1e7 | 2026-02-09 |
| AUTH-01: Implement JWT token generation with RS256 | ace7d5e | 2026-02-09 |
| AUTH-02: Create Passport.js authentication strategy | c1e04c2 | 2026-02-09 |
| AUTH-03: Create POST /auth/register endpoint | 3b648bc | 2026-02-09 |
| AUTH-04: Create POST /auth/login endpoint | bd0f7ae | 2026-02-09 |
| AUTH-05: Create POST /auth/refresh endpoint | 1d12302 | 2026-02-09 |
| AUTH-06: Create POST /auth/logout endpoint | da49b35 | 2026-02-09 |
| AUTH-07: Create auth middleware for protected routes | 325d01c | 2026-02-09 |
| AUTH-08: Implement role-based access control | af11d4f | 2026-02-09 |
| AUTH-09: Create auth store with Zustand | de6fb38 | 2026-02-09 |
| AUTH-10: Create login page with email/password form | bf0aa75 | 2026-02-09 |
| AUTH-11: Create registration page with role selection | 615cb4e | 2026-02-09 |
| AUTH-12: Create password reset flow (forgot password) | 041b7f5 | 2026-02-09 |
| AUTH-13: Implement auth guards for protected routes | 7c9e7c4 | 2026-02-09 |
| AUTH-14: Create user profile page with edit functionality | 1a1e187 | 2026-02-09 |
| AUTH-15: Add unit tests for JWT token generation/validation | fac9c60 | 2026-02-09 |
| AUTH-16: Add API tests for auth endpoints | 5f48429 | 2026-02-09 |
| AUTH-17: Add E2E tests for login/logout flow | b5a233d | 2026-02-09 |
| ADMIN-01: Create GET /admin/users endpoint | 31b1001 | 2026-02-09 |
| ADMIN-02: Create PUT /admin/users/:id/role endpoint | 1d9e2fd | 2026-02-09 |
| ADMIN-03: Create PUT /admin/users/:id/status endpoint | da37825 | 2026-02-09 |
| ADMIN-04: Create admin user management page with data table | e06d280 | 2026-02-09 |
| ADMIN-05: Create user role editor modal | e352dad | 2026-02-09 |
| ADMIN-06: Add admin route guard (administrator role) | bb1c50c | 2026-02-09 |
| ADMIN-07: Add API tests for admin endpoints | 7d3c1af | 2026-02-09 |
| PROJ-01: Create GET /projects endpoint | 045b495 | 2026-02-09 |
| PROJ-02: Create POST /projects endpoint | fd5de9a | 2026-02-09 |
| PROJ-03: Create GET /projects/:id endpoint | c5a9f6f | 2026-02-09 |
| PROJ-04: Create PUT /projects/:id endpoint | ceda9af | 2026-02-09 |
| PROJ-05: Create DELETE /projects/:id endpoint | 28765eb | 2026-02-09 |
| PROJ-06: Create POST /projects/:id/members endpoint | 01f8bb8 | 2026-02-09 |
