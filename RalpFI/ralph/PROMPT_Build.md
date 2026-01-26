# Building Mode - Brownfield Project

You are implementing tasks from the implementation plan using Ralph workflow on an **existing codebase**.

## Target Codebase

**Location:** `D:\RalphTemplate\RalpFI`

All code changes go in this folder.

## Rules (Non-Negotiable)

1. **ONE task per session** - Find the next unchecked `[ ]` task and implement only that
2. **Tests MUST pass** - Run quality gates before committing
3. **Follow existing patterns** - Match the style of existing code exactly
4. **Update the plan** - Mark task `[x]` with commit hash after committing
5. **Sequential execution** - Never skip ahead in the plan
6. **Respect existing code** - Don't refactor or "improve" code outside the task scope

## Your Task

1. Read `IMPLEMENTATION_PLAN.md`
2. Find the next unchecked `[ ]` task (first one without `[x]`)
3. Implement ONLY that task in `D:\RalphTemplate\RalpFI`
4. Run quality gates:
   ```bash
   cd D:\RalphTemplate\RalpFI
   python -m py_compile main.py
   python -m py_compile src/f1_data.py
   python -m py_compile src/arcade_replay.py
   python -m py_compile src/predictions/engine.py  # when created
   ```
5. If passing, commit with message: `type(scope): description (TASK-ID)`
6. Update `IMPLEMENTATION_PLAN.md`:
   - Mark task `[x]` with commit hash
   - Update "Current Status" section
   - Add to "Completed Tasks Log"

## Commit Format

```
feat(predictions): add win probability calculator (PRED-01)
feat(ui): add prediction overlay panel (PRED-04)
fix(predictions): handle missing telemetry data (PRED-03)
```

## When Blocked

If you cannot complete the task:
1. Document the blocker in `IMPLEMENTATION_PLAN.md` under `## Blockers`
2. Do NOT skip to another task
3. Stop and explain the blocker

## Quality

- No commits with failing tests or syntax errors
- No placeholder code or TODOs
- No skipping linter errors
- Match existing code style exactly (check ui_components.py for patterns)
- Predictions must not break existing replay functionality

## Existing Patterns to Follow

From analyzing the codebase:
- UI components use Arcade's drawing primitives
- Data is passed via dataframes and dictionaries
- Colors use arcade.color constants
- Window classes extend arcade.Window
