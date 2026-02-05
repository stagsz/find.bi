# Implementation Plan

> **Ralph Workflow**: Do tasks in order. One at a time. Update this file after each commit.

## Current Status

**Phase**: 5 - Time Tracking (Complete)
**Progress**: All Time Tracking tasks complete
**Last Completed**: TIME-41 - Add E2E test for approval workflow

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
- [x] TIME-04: Create TimerContext with start/stop/persist logic using localStorage - `c504ddc`
- [x] TIME-05: Create Timer UI component (start/stop button, elapsed time display) - `e044407`
- [x] TIME-06: Add timer to contact detail page - `40fee9a`
- [x] TIME-07: Add timer to deal detail page - `d51928e`
- [x] TIME-08: Implement "only one timer at a time" constraint - `38abc6f`
- [x] TIME-09: Add notification for timer running >8 hours - `65e2257`

### Manual Time Entry
- [x] TIME-10: Create manual time entry form component - `8d034b8`
- [x] TIME-11: Add time entry form to contact pages - `9c03b78`
- [x] TIME-12: Add time entry form to deal pages - `f17fe4a`
- [x] TIME-13: Support duration input as HH:MM or decimal - Included in TIME-10
- [x] TIME-14: Add billable checkbox (default: true) - Included in TIME-10

### Activity-Based Auto-Tracking
- [x] TIME-15: Update activity form to include "Track time" checkbox - `302e924`
- [x] TIME-16: Auto-create time entry when activity with duration is logged - `85f8b5f`
- [x] TIME-17: Link time entries to activities (activity_id foreign key) - `c37af74` (schema), `85f8b5f` (implementation)
- [x] TIME-18: Allow editing auto-created time entries - `6dd2b86`

### Approval Workflow
- [x] TIME-19: Add submit time entry action (changes status to 'submitted') - `fb80e0c`
- [x] TIME-20: Create pending approvals view for admins - `55be7cf`
- [x] TIME-21: Add approve/reject actions with optional notes - `0800101`
- [x] TIME-22: Prevent users from editing approved time entries - `3789829`
- [x] TIME-23: Handle rejected time entries (return to draft with notes) - `e410e9f`

### Admin Dashboard
- [x] TIME-24: Create admin time tracking dashboard page - `4d0e2cc`
- [x] TIME-25: Add total hours summary (today, this week, this month) - `4d0e2cc` (included in TIME-24)
- [x] TIME-26: Add hours by user table (sortable) - `fe3cc75`
- [x] TIME-27: Add hours by contact/deal breakdown (top 10) - `4b5d7dc`
- [x] TIME-28: Add date range filter - `d82bd7c`
- [x] TIME-29: Add billable/non-billable filter - `ca9508d`
- [x] TIME-30: Add approval status filter - `bde05f6`
- [x] TIME-31: Add hours per day chart (last 7 days) - `899fa1a`

### Reporting & Export
- [x] TIME-32: Create time tracking report page - `2bb4fab`
- [x] TIME-33: Add CSV export with all time entry fields - `a292e74`
- [x] TIME-34: Add billable vs non-billable breakdown - `b3ba93e`
- [x] TIME-35: Add approval status breakdown - `f1052be`

### Testing
- [x] TIME-36: Add unit tests for Timer component - `3e36a90`
- [x] TIME-37: Add unit tests for time entry form - `256ebfe`
- [x] TIME-38: Add unit tests for time entry actions - `f91afb0`
- [x] TIME-39: Add E2E test for timer flow - `af8dd0f`
- [x] TIME-40: Add E2E test for manual entry flow - `3df1dad`
- [x] TIME-41: Add E2E test for approval workflow - `c287800`

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
| TIME-04: TimerContext with start/stop/persist | `c504ddc` | 2026-02-04 |
| TIME-05: Timer UI component | `e044407` | 2026-02-04 |
| TIME-06: Timer on contact detail page | `40fee9a` | 2026-02-04 |
| TIME-07: Timer on deal detail page | `d51928e` | 2026-02-04 |
| TIME-08: Single timer constraint | `38abc6f` | 2026-02-04 |
| TIME-09: Timer 8+ hour notification | `65e2257` | 2026-02-04 |
| TIME-10: Manual time entry form component | `8d034b8` | 2026-02-04 |
| TIME-11: Time entry form on contact pages | `9c03b78` | 2026-02-04 |
| TIME-12: Time entry form on deal pages | `f17fe4a` | 2026-02-04 |
| TIME-15: Track time checkbox in activity form | `302e924` | 2026-02-04 |
| TIME-16: Auto-create time entry on activity save | `85f8b5f` | 2026-02-04 |
| TIME-17: Link time entries to activities | `c37af74`, `85f8b5f` | 2026-02-04 |
| TIME-18: Allow editing auto-created time entries | `6dd2b86` | 2026-02-04 |
| TIME-19: Add submit time entry action | `fb80e0c` | 2026-02-04 |
| TIME-20: Pending approvals view for admins | `55be7cf` | 2026-02-04 |
| TIME-21: Add approve/reject time entry actions | `0800101` | 2026-02-04 |
| TIME-22: Prevent editing approved time entries | `3789829` | 2026-02-04 |
| TIME-23: Handle rejected time entries with resubmit | `e410e9f` | 2026-02-04 |
| TIME-24: Create admin time tracking dashboard | `4d0e2cc` | 2026-02-04 |
| TIME-25: Add total hours summary (today/week/month) | `4d0e2cc` | 2026-02-04 |
| TIME-26: Add sortable hours by user table | `fe3cc75` | 2026-02-05 |
| TIME-27: Add sortable contact/deal hours tables | `4b5d7dc` | 2026-02-05 |
| TIME-28: Add date range filter to admin dashboard | `d82bd7c` | 2026-02-05 |
| TIME-29: Add billable/non-billable filter | `ca9508d` | 2026-02-05 |
| TIME-30: Add approval status filter | `bde05f6` | 2026-02-05 |
| TIME-31: Add hours per day chart (last 7 days) | `899fa1a` | 2026-02-05 |
| TIME-32: Create time tracking report page | `2bb4fab` | 2026-02-05 |
| TIME-33: Add CSV export with all time entry fields | `a292e74` | 2026-02-05 |
| TIME-34: Add billable vs non-billable breakdown | `b3ba93e` | 2026-02-05 |
| TIME-35: Add approval status breakdown | `f1052be` | 2026-02-05 |
| TIME-36: Add unit tests for Timer component | `3e36a90` | 2026-02-05 |
| TIME-37: Add unit tests for TimeEntryForm | `256ebfe` | 2026-02-05 |
| TIME-38: Add unit tests for time entry actions | `f91afb0` | 2026-02-05 |
| TIME-39: Add E2E test for timer flow | `af8dd0f` | 2026-02-05 |
| TIME-40: Add E2E test for manual entry flow | `3df1dad` | 2026-02-05 |
| TIME-41: Add E2E test for approval workflow | `c287800` | 2026-02-05 |
