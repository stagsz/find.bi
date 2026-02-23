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
   - Backend: `cd backend && mypy app && ruff check app && pytest`
   - Frontend: `cd frontend && npm run typecheck && npm run lint && npm test`
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
