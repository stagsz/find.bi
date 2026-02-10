# Building Mode

You are implementing tasks from the implementation plan using Ralph workflow.

## Rules (Non-Negotiable)

1. **ONE task per session** - Find the next unchecked `[ ]` task and implement only that
2. **Tests MUST pass** - Run quality gates before committing
3. **Follow existing patterns** - Match the style of existing code exactly
4. **Update the plan** - Mark task `[x]` with commit hash after committing
5. **Sequential execution** - Never skip ahead in the plan

## Your Task: Eight-Step Execution Cycle

1. **Orient** - Study relevant specifications (from `specs/` if they exist, or project context from `CLAUDE.md`)
2. **Read** - Review `IMPLEMENTATION_PLAN.md` and find next unchecked `[ ]` task
3. **Select** - Choose the most important unchecked task (first one without `[x]`)
4. **Investigate** - Search existing code without assumptions
   - **CRITICAL**: Don't assume features aren't already implemented
   - Use parallel subagents (up to 500) for searching and reading files
   - Search for related patterns, similar implementations, existing utilities
   - Understand how existing code works before making changes
5. **Implement** - Make changes ONLY for the selected task
   - Follow existing patterns exactly
   - Use a single subagent for implementation work
6. **Validate** - Run quality gates (backpressure):
   - Backend: `cd apps/api && npm run typecheck && npm run lint && npm test`
   - Frontend: `cd apps/web && npm run typecheck && npm run lint && npm test`
   - Use a single subagent for tests and builds
7. **Update** - If passing, update `IMPLEMENTATION_PLAN.md`:
   - Mark task `[x]` with commit hash
   - Update "Current Status" section
   - Add to "Completed Tasks Log"
   - Document any discoveries or issues found
8. **Commit** - Save changes with message: `type(scope): description (TASK-ID)`
   - Capture the "why" in commit message, not just the "what"

## Commit Format

```
feat(api): add POST /users endpoint (API-03)
fix(ui): handle empty state in UserList (UI-07)
test(auth): add JWT validation tests (TEST-02)
```

## When Blocked

If you cannot complete the task:
1. Document the blocker in `IMPLEMENTATION_PLAN.md` under `## Blockers`
2. Do NOT skip to another task
3. Stop and explain the blocker

## Context Efficiency

**Important**: With ~176K usable tokens from a 200K window, allocate 40-60% to the "smart zone" for complex reasoning.

**Subagent usage**:
- **Search/Read phase**: Use up to 500 parallel Sonnet subagents for exploration
- **Build/Test phase**: Use only 1 Sonnet subagent to avoid overwhelming the system
- This maximizes context efficiency by parallelizing investigation but serializing implementation

## Quality

- No commits with failing tests
- No placeholder code or TODOs
- No skipping linter errors
- Match existing code style exactly
- Capture the "why" in commits, not just the "what"

## Design System & UI Principles

**Design Direction**: Regulatory Document (Clean, Print-Ready)

This HazOp Assistant is for **industrial safety engineers** conducting life-critical hazard analysis. The UI must embody professional authority and regulatory compliance.

### Core Design Principles

1. **Professional & Authoritative** - Clean, structured layouts that inspire trust
2. **Data-Dense but Clear** - Engineers need information, not marketing fluff
3. **Print-Optimized** - Reports are exported to Word/PDF for regulatory submission
4. **Purposeful & Functional** - Form follows function, no decorative elements
5. **Distinctive** - Avoid generic SaaS aesthetics (no gratuitous gradients, shadows, or rounded corners)

### Visual Language

**Color Palette**:
- **Base**: Clean whites, light grays for backgrounds (optimized for printing)
- **Text**: Dark grays and blacks for high readability
- **Semantic Colors**:
  - Risk Low: Green (#22c55e)
  - Risk Medium: Amber (#f59e0b)
  - Risk High: Red (#ef4444)
- **Accents**: Navy blue for primary actions, subtle use only
- **NO**: Gradients, vibrant marketing colors, decorative backgrounds

**Typography**:
- **Headings**: Clear hierarchy with appropriate weights (600-700)
- **Body**: Readable sans-serif (system fonts or professional alternatives)
- **Data Tables**: Monospaced fonts for technical values
- **NO**: Decorative fonts, excessive font weights

**Layout**:
- **Structure**: Grid-based, aligned to baseline grid
- **Spacing**: Consistent, generous whitespace for clarity
- **Tables**: Clean borders, alternating row colors for scan-ability
- **Forms**: Clear labels, inline validation, structured field groups
- **NO**: Card-heavy layouts, excessive shadows, over-rounded corners

**Components**:
- **Buttons**: Clear, rectangular with subtle rounding (max rounded-md)
- **Tables**: Stripe pattern, sortable headers, freeze columns for wide data
- **Forms**: Inline labels, clear validation states, logical grouping
- **Modals**: Centered, not excessive (prefer inline when possible)
- **Navigation**: Sidebar or top nav, not both - keep it simple

### Anti-Patterns to Avoid

❌ Generic SaaS dashboard aesthetics (glassmorphism, neumorphism, etc.)
❌ Marketing-heavy hero sections with blurred background blobs
❌ Overuse of animations that distract from workflow
❌ Card layouts for everything (use tables where appropriate)
❌ Excessive rounding (rounded-xl, rounded-2xl on every element)
❌ Low-contrast grays that fail WCAG AA standards

### Skills Available

When implementing UI components, leverage these installed skills:
- **frontend-design**: Creates distinctive, production-grade interfaces that avoid generic AI aesthetics
- **vercel-react-best-practices**: Ensures optimal React patterns and performance

Use these skills proactively during AUTH-09 through AUTH-14 (frontend auth UI) and all subsequent UI tasks.
