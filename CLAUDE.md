# CLAUDE.md

## Ralph Workflow

This project uses the **Ralph autonomous AI methodology**.

### Rules (Non-Negotiable)

1. **ONE task per iteration** - Never multi-task
2. **Tests MUST pass** - No commits with failing tests
3. **Follow existing patterns** - Match the style of existing code
4. **Update the plan** - Mark tasks [x] with commit hash after each commit
5. **Sequential execution** - Never skip ahead

### The Loop

```
1. Read IMPLEMENTATION_PLAN.md
2. Find next unchecked [ ] task
3. Implement ONLY that task
4. Run tests and linters
5. If passing → commit
6. Mark task [x] with commit hash
7. IMMEDIATELY continue to next task
8. Only stop if blocked
```

### Quality Gates

Run before every commit:

```bash
# Backend (Node.js/Express)
cd apps/api && npm run typecheck && npm run lint && npm test

# Frontend (React/Vite)
cd apps/web && npm run typecheck && npm run lint && npm test

# E2E Tests
npm run test:e2e
```

### Commit Format

```
<type>(<scope>): <description> (<TASK-ID>)

Types: feat, fix, test, refactor, docs, chore
```

### When Blocked

1. Document blocker in IMPLEMENTATION_PLAN.md under `## Blockers`
2. Stop and report
3. Do NOT skip to another task
4. Wait for user decision

---

## Project Overview

**HazOp Assistant** - An integrated platform for conducting Hazard and Operability Studies (HazOps) in the process industry. The system guides engineers through established HazOps methodology while automating documentation, risk assessment, and compliance validation.

### Key Features
- P&ID (Piping & Instrumentation Diagram) interpretation and analysis
- Node-by-node HazOps analysis with standard guide words
- Risk assessment using severity × likelihood × detectability methodology
- LOPA (Layers of Protection Analysis) validation
- Regulatory compliance cross-referencing (IEC 61511, ISO 31000, OSHA PSM, etc.)
- Professional report generation (Word, PDF, Excel, PowerPoint)
- Real-time collaborative analysis sessions

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript 5.3+, Vite, Tailwind CSS, Mantine UI |
| Backend | Node.js 20.x, Express.js, TypeScript |
| Database | PostgreSQL 15+ |
| Cache | Redis 7.x |
| File Storage | MinIO (S3-compatible) |
| Message Queue | RabbitMQ |
| Real-time | Socket.io |
| Authentication | JWT + Passport.js |
| Testing | Vitest (frontend), Jest (backend), Playwright (E2E) |
| Monorepo | Nx |
| Deployment | Docker Compose, Nginx |
| Monitoring | Prometheus, Grafana, Winston, Loki |

---

## Domain Knowledge

### HazOps Methodology
A **Hazard and Operability Study (HazOps)** is a structured technique for identifying potential hazards in industrial processes. The methodology uses guide words applied to process parameters to systematically identify deviations.

### Guide Words
Standard guide words used in HazOps analysis:
- **NO** - Complete negation of intention (e.g., no flow)
- **MORE** - Quantitative increase (e.g., more pressure)
- **LESS** - Quantitative decrease (e.g., less temperature)
- **REVERSE** - Opposite of intention (e.g., reverse flow)
- **EARLY** - Timing-related early occurrence
- **LATE** - Timing-related late occurrence
- **OTHER THAN** - Qualitative deviation (e.g., wrong composition)

### Analysis Workflow
```
Node Selection → Guide Word → Deviation → Cause → Consequence → Safeguard → Recommendation → Risk Assessment → Compliance Check
```

### Risk Assessment
- **Severity**: Impact of consequence (1-5 scale: Negligible → Catastrophic)
- **Likelihood**: Probability of occurrence (1-5 scale: Rare → Almost Certain)
- **Detectability**: Ability to detect before impact (1-5 scale: Almost Certain → Undetectable)
- **Risk Score**: Severity × Likelihood × Detectability (1-125)
- **Risk Level**: Low (1-20), Medium (21-60), High (61-125)

### User Roles
- `administrator` - Full system access, user management
- `lead_analyst` - Project management, analysis review/approval
- `analyst` - Conduct HazOps analyses, create reports
- `viewer` - Read-only access to projects and reports

### Project Statuses
- `planning` - Initial setup, P&ID upload
- `active` - Analysis in progress
- `review` - Analysis complete, awaiting approval
- `completed` - Approved and finalized
- `archived` - Historical record

### Equipment Types (P&ID Nodes)
- `pump` - Fluid moving equipment
- `valve` - Flow control devices
- `reactor` - Chemical reaction vessels
- `heat_exchanger` - Heat transfer equipment
- `pipe` - Process piping
- `tank` - Storage vessels
- `other` - Miscellaneous equipment

### Regulatory Standards
- **IEC 61511** - Functional safety for process industries
- **ISO 31000** - Risk management principles
- **ISO 9001** - Quality management systems
- **ATEX/DSEAR** - Explosive atmospheres directives
- **PED** - Pressure Equipment Directive
- **OSHA PSM** - Process Safety Management (US)
- **EPA RMP** - Risk Management Program (US)
- **SEVESO III** - Major accident hazards directive (EU)

### Project Structure
```
hazop-assistant/
├── apps/
│   ├── api/                    # Express.js backend
│   │   ├── src/
│   │   │   ├── controllers/   # Route handlers
│   │   │   ├── services/      # Business logic
│   │   │   ├── models/        # Database models
│   │   │   ├── middleware/    # Auth, validation, etc.
│   │   │   ├── routes/        # API routes
│   │   │   └── utils/         # Helper functions
│   │   └── tests/
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/    # Reusable UI components
│       │   ├── pages/         # Route-level pages
│       │   ├── layouts/       # Layout components
│       │   ├── hooks/         # Custom React hooks
│       │   ├── services/      # API client
│       │   ├── store/         # Zustand state
│       │   └── utils/         # Helpers, types
│       └── tests/
├── packages/
│   ├── types/                  # Shared TypeScript types
│   └── utils/                  # Shared utilities
├── docker/                     # Docker configurations
├── migrations/                 # Database migrations
└── e2e/                        # Playwright E2E tests
```
