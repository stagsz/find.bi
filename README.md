# find.bi

Your data talks. Ralph listens.

A self-hosted, local-first Business Intelligence platform with interactive dashboards, AI-powered data analysis, and a conversational voice assistant. A personal alternative to Power BI and Tableau that runs entirely on your own machine.

## Quick Start

**Windows (PowerShell):**
```powershell
# 1. Copy template to new project folder
cp -r C:\Users\staff\find.bi C:\Users\staff\MyProject
cd C:\Users\staff\MyProject

# 2. Run interactive setup wizard (asks questions step-by-step)
.\setup_project.ps1

# 3. Review and edit PRD.json if needed

# 4. Generate implementation plan
.\loop.ps1 plan

# 5. Start building
.\loop.ps1 build
```

**Mac/Linux (Bash):**
```bash
# 1. Copy template
cp -r ~/find.bi ~/MyProject
cd ~/MyProject

# 2. Run setup wizard
./setup_project.sh

# 3. Review PRD.json

# 4. Generate plan
./loop.sh plan

# 5. Build
./loop.sh build
```

**The setup wizard will ask you:**
- Project name and description
- Project type (full-stack, backend, frontend, CLI)
- Tech stack (React, FastAPI, PostgreSQL, etc.)
- Key features you want to build
- Authentication and API needs

## What is Ralph?

Ralph is an autonomous AI development loop following an eight-step execution cycle:
1. **Orient** - Study specs and context
2. **Read** - Review implementation plan
3. **Select** - Choose next task
4. **Investigate** - Search existing code (don't assume not implemented)
5. **Implement** - Make changes
6. **Validate** - Run tests as backpressure
7. **Update** - Mark task complete, document learnings
8. **Commit** - Save with the "why"

## Files

| File | Purpose | Edit? |
|------|---------|:-----:|
| `setup_project.ps1` | **Interactive setup wizard** | Run first |
| `PRD.json` | Your product requirements | After setup |
| `CLAUDE.md` | Project context | Auto-filled |
| `IMPLEMENTATION_PLAN.md` | Task queue | Auto-generated |
| `loop.ps1` / `loop.sh` | The autonomous loop | No |
| `PROMPT_Plan.md` | Planning mode instructions | No |
| `PROMPT_Build.md` | Build mode instructions | No |
| `AGENTS.md` | Quick reference | No |
| `evaluate_loop.ps1` | Quality/security checks | No |
| `check_prompt_injection.ps1` | Security scanner | No |
| `specs/` | (Optional) Detailed specs | Advanced |
| `hooks/` | (Optional) Git hooks | Advanced |

## Commands

```bash
./loop.sh plan            # Generate implementation plan
./loop.sh build           # Start autonomous building
./loop.sh build 20        # Limit to 20 iterations
./loop.sh 20              # Shorthand for build 20
```

```powershell
.\loop.ps1 plan           # Generate implementation plan
.\loop.ps1 build          # Start autonomous building
```
