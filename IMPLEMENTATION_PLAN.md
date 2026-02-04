# Implementation Plan

> **Ralph Workflow**: Do tasks in order. One at a time. Update this file after each commit.

## Current Status

**Phase**: 4 - Admin Features (Complete)
**Progress**: All admin features complete
**Last Completed**: ADMIN-04 - Add system-wide statistics for admins

---

## Gap Analysis Summary

The CRM application has been substantially built with the following features:
- Authentication (login, signup, password reset)
- Contact management (CRUD, import/export CSV, custom fields)
- Deal pipeline (CRUD, stages, linked to contacts)
- Activities & Tasks (CRUD, Kanban board)
- Dashboard with metrics and charts
- Dark mode support
- Role-based access control (admin/user)

**Missing/Incomplete:**
1. PRD.json not filled in (template placeholders remain)
2. No TypeScript strict mode configuration
3. Missing ESLint configuration
4. E2E tests exist but may need verification
5. Admin panel exists but functionality may be incomplete
6. No API documentation
7. No deployment configuration (Vercel/Docker)

---

## Phase 1: Foundation (EXISTING - Review & Fix)

### Project Setup
- [x] SETUP-01: Initialize git repo with .gitignore (existing)
- [x] SETUP-02: Create directory structure (existing)
- [x] SETUP-03: Initialize Next.js 15 with TypeScript (existing)
- [x] SETUP-04: Configure Tailwind CSS (existing)
- [x] SETUP-05: Set up Supabase client libraries (existing)
- [x] SETUP-06: Add TypeScript strict mode to tsconfig.json (already configured)
- [~] SETUP-07: Add ESLint configuration with Next.js recommended rules (BLOCKED: CRM/ not in git)
- [x] SETUP-08: Verify all dependencies are up to date

### Database Models
- [x] DB-01: Create users table with RLS (existing)
- [x] DB-02: Create contacts table with RLS (existing)
- [x] DB-03: Create deals table with RLS (existing)
- [x] DB-04: Create activities table with RLS (existing)
- [x] DB-05: Add database seeding script for development - `4ad854d`

### Core Backend
- [x] API-01: Create Supabase server client (existing)
- [x] API-02: Implement contact CRUD actions (existing)
- [x] API-03: Implement deal CRUD actions (existing)
- [x] API-04: Implement activity CRUD actions (existing)

---

## Phase 2: Authentication (EXISTING - Complete)

- [x] AUTH-01: Configure Supabase Auth (existing)
- [x] AUTH-02: Create login page and action (existing)
- [x] AUTH-03: Create signup page and action (existing)
- [x] AUTH-04: Create password reset flow (existing)
- [x] AUTH-05: Add auth middleware for protected routes (existing)
- [x] AUTH-06: Implement role-based permissions (existing)

---

## Phase 3: Core Features (EXISTING - Verify & Polish)

### Contact Management
- [x] UI-01: Create contacts list page with table (existing)
- [x] UI-02: Create contact detail page (existing)
- [x] UI-03: Create contact form (new/edit) (existing)
- [x] UI-04: Add contact delete functionality (existing)
- [x] UI-05: Implement CSV import wizard (existing)
- [x] UI-06: Implement CSV export (existing)
- [x] UI-07: Add custom fields support (existing)

### Deal Pipeline
- [x] UI-08: Create deals list page (existing)
- [x] UI-09: Create deal detail page (existing)
- [x] UI-10: Create deal form (new/edit) (existing)
- [x] UI-11: Add deal delete functionality (existing)
- [x] UI-12: Add deal pipeline Kanban view (drag-and-drop stages) - `93f6902`

### Activities & Tasks
- [x] UI-13: Create activity form component (existing)
- [x] UI-14: Create activity timeline component (existing)
- [x] UI-15: Add activities to contact detail (existing)
- [x] UI-16: Add activities to deal detail (existing)
- [x] UI-17: Create tasks Kanban board page (existing)
- [x] UI-18: Add drag-and-drop task status updates - `642cc11`

### Dashboard
- [x] UI-19: Create dashboard page with metrics (existing)
- [x] UI-20: Add pipeline breakdown chart (existing)
- [x] UI-21: Add deals donut chart (existing)
- [x] UI-22: Show recent deals list (existing)
- [x] UI-23: Show upcoming tasks list (existing)
- [x] UI-24: Add date range filter for dashboard metrics - `b5ada36`

### Navigation & Layout
- [x] UI-25: Create main navigation component (existing)
- [x] UI-26: Add dark mode toggle (existing)
- [x] UI-27: Create responsive layout (existing)

---

## Phase 4: Admin Features

- [x] ADMIN-01: Create admin page route (existing)
- [x] ADMIN-02: Add user management (list all users) - `4c1506d`
- [x] ADMIN-03: Add ability to change user roles - `8857a92`
- [x] ADMIN-04: Add system-wide statistics for admins - `7fe2610`

---

## Phase 5: Time Tracking (Epic 5 - IN PROGRESS)

### Database Schema
- [x] TIME-01: Create time_entries table migration with all fields (user_id, contact_id, deal_id, activity_id, duration_minutes, entry_date, notes, is_billable, status, approval_notes, approved_by, approved_at) - `c37af74`
- [x] TIME-02: Add RLS policies for time_entries (users see own entries, admins see all) - `db1dabc`
- [x] TIME-03: Create indexes for time_entries (user+date, contact, deal, status, billable) - Included in TIME-01

### Timer Component
- [ ] TIME-04: Create TimerContext with start/stop/persist logic using localStorage
- [ ] TIME-05: Create Timer UI component (start/stop button, elapsed time display)
- [ ] TIME-06: Add timer to contact detail page
- [ ] TIME-07: Add timer to deal detail page
- [ ] TIME-08: Implement "only one timer at a time" constraint
- [ ] TIME-09: Add notification for timer running >8 hours

### Manual Time Entry
- [ ] TIME-10: Create manual time entry form component
- [ ] TIME-11: Add time entry form to contact pages
- [ ] TIME-12: Add time entry form to deal pages
- [ ] TIME-13: Support duration input as HH:MM or decimal
- [ ] TIME-14: Add billable checkbox (default: true)

### Activity-Based Auto-Tracking
- [ ] TIME-15: Update activity form to include "Track time" checkbox
- [ ] TIME-16: Auto-create time entry when activity with duration is logged
- [ ] TIME-17: Link time entries to activities (activity_id foreign key)
- [ ] TIME-18: Allow editing auto-created time entries

### Approval Workflow
- [ ] TIME-19: Add submit time entry action (changes status to 'submitted')
- [ ] TIME-20: Create pending approvals view for admins
- [ ] TIME-21: Add approve/reject actions with optional notes
- [ ] TIME-22: Prevent users from editing approved time entries
- [ ] TIME-23: Handle rejected time entries (return to draft with notes)

### Admin Dashboard
- [ ] TIME-24: Create admin time tracking dashboard page
- [ ] TIME-25: Add total hours summary (today, this week, this month)
- [ ] TIME-26: Add hours by user table (sortable)
- [ ] TIME-27: Add hours by contact/deal breakdown (top 10)
- [ ] TIME-28: Add date range filter
- [ ] TIME-29: Add billable/non-billable filter
- [ ] TIME-30: Add approval status filter
- [ ] TIME-31: Add hours per day chart (last 7 days)

### Reporting & Export
- [ ] TIME-32: Create time tracking report page
- [ ] TIME-33: Add CSV export with all time entry fields
- [ ] TIME-34: Add billable vs non-billable breakdown
- [ ] TIME-35: Add approval status breakdown

### Testing
- [ ] TIME-36: Add unit tests for Timer component
- [ ] TIME-37: Add unit tests for time entry form
- [ ] TIME-38: Add unit tests for time entry actions
- [ ] TIME-39: Add E2E test for timer flow
- [ ] TIME-40: Add E2E test for manual entry flow
- [ ] TIME-41: Add E2E test for approval workflow

---

## Phase 6: Testing (Original)

### Unit Tests
- [x] TEST-01: Set up Vitest configuration (existing)
- [x] TEST-02: Add ActivityForm component tests (existing)
- [x] TEST-03: Add ActivityTimeline component tests (existing)
- [x] TEST-04: Add permissions utility tests (existing)
- [x] TEST-05: Add activity actions tests (existing)
- [ ] TEST-06: Add contact actions tests
- [ ] TEST-07: Add deal actions tests
- [ ] TEST-08: Add ContactForm component tests
- [ ] TEST-09: Add DealForm component tests

### E2E Tests
- [x] TEST-10: Set up Playwright configuration (existing)
- [x] TEST-11: Add auth flow e2e tests (existing)
- [x] TEST-12: Add activities e2e tests (existing)
- [ ] TEST-13: Add contacts e2e tests
- [ ] TEST-14: Add deals e2e tests
- [ ] TEST-15: Add dashboard e2e tests

---

## Phase 6: Polish & Deployment

### Documentation
- [ ] DOCS-01: Fill in PRD.json with actual requirements
- [ ] DOCS-02: Update README with setup instructions
- [ ] DOCS-03: Add environment variable documentation

### Deployment
- [ ] DEPLOY-01: Add Vercel configuration (vercel.json)
- [ ] DEPLOY-02: Configure production environment variables
- [ ] DEPLOY-03: Set up Supabase production project
- [ ] DEPLOY-04: Add GitHub Actions for CI/CD

### Performance & UX
- [ ] PERF-01: Add loading states to all pages
- [ ] PERF-02: Add error boundaries
- [ ] PERF-03: Optimize images and assets
- [ ] PERF-04: Add search functionality to contacts/deals lists

---

## Blockers

### NOTE: Dependency Update Summary (SETUP-08)

**Status:** ✅ COMPLETED

**Actions Taken:**
- Updated all dependencies to latest compatible versions within semver ranges
- Fixed critical Next.js vulnerability (15.5.6 → 15.5.11)
- Fixed syntax errors in `e2e/activities.spec.ts` (lines 88, 172)
- Updated package-lock.json

**Remaining Issues (Pre-existing, not caused by update):**
- 1 moderate Next.js vulnerability (requires breaking upgrade to v16)
- TypeScript errors in test files and components (23 errors)
- ESLint errors in codebase (27 errors)
- 3 failing unit tests (test assertions don't match component output)

**Major Version Updates Available (Breaking Changes - Not Applied):**
- Next.js: 15.5.11 → 16.1.6
- Vitest: 3.2.4 → 4.0.18
- @types/node: 24.x → 25.x
- jsdom: 27.x → 28.x
- @supabase/ssr: 0.7.0 → 0.8.0

---

### BLOCKER #2: CRM directory not tracked in git (2026-02-04)

**Status:** 🟡 BLOCKING SETUP-07 COMMIT

**Issue:** The `CRM/` directory is not tracked in git (showing as untracked). ESLint configuration (eslint.config.mjs, package.json) cannot be committed in isolation.

**Files Ready:**
- `CRM/eslint.config.mjs` - Created with Next.js flat config
- `CRM/package.json` - Updated with ESLint dependencies and lint/typecheck scripts

**Options:**
1. Commit the entire CRM directory first (creates a large initial commit)
2. Wait for user to commit CRM first, then commit ESLint changes

**User Decision Needed:** Should the CRM/ directory be added to git?

---

### BLOCKER #1: Conflicting Requirements (2026-02-04) - ✅ RESOLVED

**Status:** ✅ RESOLVED

**User Decision:** Follow the PRD. Build Epic 5 (Time Tracking) next.

**Resolution:** Implementation plan updated to include Epic 5 tasks below. Will focus on Time Tracking feature complete with tests before moving to other epics.

---

## Completed Tasks Log

| Task | Commit | Date |
|------|--------|------|
| Initial CRM implementation | (pre-existing) | Before planning |
| SETUP-06: TypeScript strict mode | (already configured) | 2026-02-04 |
| SETUP-07: ESLint configuration | pending commit | 2026-02-04 |
| SETUP-08: Verify dependencies | `b1c0793` | 2026-02-04 |
| DB-05: Database seeding script | `4ad854d` | 2026-02-04 |
| UI-12: Deal pipeline Kanban view | `93f6902` | 2026-02-04 |
| UI-18: Task Kanban drag-and-drop | `642cc11` | 2026-02-04 |
| UI-24: Dashboard date range filter | `b5ada36` | 2026-02-04 |
| ADMIN-02: User management with search/filters | `4c1506d` | 2026-02-04 |
| ADMIN-03: Role change dropdown for admins | `8857a92` | 2026-02-04 |
| ADMIN-04: System-wide statistics for admins | `7fe2610` | 2026-02-04 |
