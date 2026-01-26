# Ralph Build Template

Autonomous AI-driven development using the Ralph workflow.
Based on [Geoff Huntley's Ralph methodology](https://ghuntley.com/ralph/).

## Quick Start

```bash
# 1. Copy template
cp -r D:/RalphTemplate D:/MyProject
cd D:/MyProject

# 2. Edit PRD.json with your requirements

# 3. Generate plan
./loop.sh plan          # or .\loop.ps1 plan on Windows

# 4. Build
./loop.sh build         # or .\loop.ps1 build on Windows
```

## What is Ralph?

Ralph is an autonomous AI development loop:
1. **Plan** - Generate implementation tasks from requirements
2. **Build** - Execute one task at a time, commit, repeat
3. **Track** - Progress tracked in `IMPLEMENTATION_PLAN.md`

## Files

| Edit | File | Purpose |
|:----:|------|---------|
| ✏️ | `PRD.json` | Your product requirements |
| | `PROMPT_Plan.md` | Planning mode instructions |
| | `PROMPT_Build.md` | Build mode instructions |
| | `CLAUDE.md` | Project context (auto-filled) |
| | `IMPLEMENTATION_PLAN.md` | Task queue (auto-generated) |
| | `loop.sh` / `loop.ps1` | The autonomous loop |

## Commands

```bash
./loop.sh plan          # Generate implementation plan
./loop.sh build         # Build autonomously (unlimited)
./loop.sh build 20      # Build max 20 iterations
./loop.sh 20            # Shorthand for above
```

Press `Ctrl+C` to stop.

## Logs

Output is logged to `ralph_log_YYYYMMDD.txt`.

## Documentation

See `QUICKSTART.md` for detailed instructions.
