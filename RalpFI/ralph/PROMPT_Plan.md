# Planning Mode - Brownfield Project

You are planning a feature addition to an **existing codebase**.

## Your Task

1. **Read PRD.json** - Understand what feature we're building
2. **Analyze the existing codebase** at `D:\RalphTemplate\RalpFI`:
   - Read key files to understand patterns and architecture
   - Note coding style, naming conventions, file organization
   - Identify integration points for new features
3. **Generate IMPLEMENTATION_PLAN.md** with detailed tasks

## Brownfield Planning Rules

- **Phase 0 must be "Discovery"** - Analyze existing code before any changes
- **Respect existing patterns** - New code must match existing style
- **Identify integration points** - Where does new code hook into existing?
- **Minimize changes to existing files** - Prefer new files when possible
- **Consider backwards compatibility** - Don't break existing features

## Key Files to Analyze

Before planning, READ these files in `D:\RalphTemplate\RalpFI`:
- `main.py` - Entry point
- `src/interfaces/race_replay.py` - Main race window (integration point)
- `src/ui_components.py` - Existing UI patterns
- `src/f1_data.py` - Data structures and telemetry format
- `src/lib/tyres.py` - Type patterns
- `requirements.txt` - Current dependencies

## Output Format

Generate `IMPLEMENTATION_PLAN.md` with:

```markdown
# Implementation Plan

> **Ralph Workflow**: Do tasks in order. One at a time. Update this file after each commit.

## Current Status

**Phase**: 0 - Discovery
**Progress**: 0 / N tasks
**Last Completed**: None

---

## Phase 0: Discovery & Setup

### Codebase Analysis
- [ ] DISC-01: Document existing UI component patterns from ui_components.py
- [ ] DISC-02: Document data structures in f1_data.py
- [ ] DISC-03: Map integration points in race_replay.py

### Environment Setup
- [ ] SETUP-01: Add new dependencies (scikit-learn, scipy) to requirements.txt
- [ ] SETUP-02: Create src/predictions/ directory structure

---

## Phase 1: Core Prediction Engine

- [ ] PRED-01: Create prediction data models
- [ ] PRED-02: Implement pace calculation algorithm
... etc

---

## Blockers

*None currently*

---

## Completed Tasks Log

| Task | Commit | Date |
|------|--------|------|
| - | - | - |
```

## Task Guidelines

- Each task should be completable in **1-2 hours max**
- Tasks must be **specific and actionable**
- Include **file paths** where changes will be made
- **Discovery tasks** document findings in code comments or a NOTES.md
- **Integration tasks** must specify exactly which existing functions to modify

Now read PRD.json and the existing codebase, then generate the implementation plan.
