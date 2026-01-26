# AGENTS.md - Quick Reference

## Start Building

```
Read PROMPT.md and PRD.json. Generate IMPLEMENTATION_PLAN.md with all tasks.
Update CLAUDE.md with project details. Then begin Ralph workflow.
```

## Continue

```
Continue.
```

## The Loop

```
┌──────────────────────────────────┐
│ 1. Read IMPLEMENTATION_PLAN.md   │
│ 2. Find next [ ] task            │
│ 3. Implement ONLY that task      │
│ 4. Run tests + linters           │
│ 5. Commit if passing             │
│ 6. Mark [x] with commit hash     │
│ 7. Continue immediately          │
└──────────────────────────────────┘
```

## Task Prefixes

| Prefix | Area |
|--------|------|
| SETUP- | Project initialization |
| DB- | Database models/migrations |
| API- | Backend endpoints |
| AUTH- | Authentication |
| UI- | Frontend components |
| TEST- | Test coverage |
| INT- | Integrations |
| EXP- | Export/reporting |

## Commit Format

```
<type>(<scope>): <description> (<TASK-ID>)
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`

## Commands

### Check Progress
```
What's the current status?
```

### Pause
```
Stop after this task.
```

### Handle Blocker
```
I've decided: [decision]. Continue.
```

## Rules

1. ONE task at a time
2. Tests MUST pass
3. Follow existing patterns
4. Update plan after commit
5. Never skip tasks
