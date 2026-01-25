# Ralph Template - Quick Start

## The Easy Way (Automated Loop)

```powershell
# Windows PowerShell
.\loop.ps1

# Windows CMD
loop.bat

# Mac/Linux
./loop.sh
```

The loop script handles everything - generates the plan on first run, then continuously executes tasks until you stop it (Ctrl+C).

---

## The Manual Way

## Step 1: Copy This Template

```bash
cp -r D:/RalphTemplate D:/YourProjectName
cd D:/YourProjectName
```

## Step 2: Fill In Your Project Details

Edit these two files:

### PROMPT.md
Describe what you're building in plain language.

### PRD.json
Structure your requirements:
- Product info
- User personas
- Features list
- Tech stack
- Data models

## Step 3: Configure Permissions (One-Time)

Edit `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(pip *)",
      "Bash(python *)",
      "Bash(pytest *)",
      "Bash(mypy *)",
      "Bash(ruff *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(mkdir *)",
      "Bash(alembic *)",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep"
    ]
  }
}
```

## Step 4: Start Claude Code

```bash
cd D:/YourProjectName
claude
```

## Step 5: Generate the Plan & Start Building

Paste this prompt:

```
Read PROMPT.md and PRD.json.

1. Generate a complete IMPLEMENTATION_PLAN.md with:
   - Tasks broken into logical phases
   - Each task completable in 1-2 hours max
   - Task IDs with prefixes (SETUP-, DB-, API-, UI-, AUTH-, etc)
   - Update the Current Status section

2. Update CLAUDE.md with:
   - Project overview filled in
   - Tech stack table completed
   - Domain knowledge section populated

3. Begin Ralph workflow - implement tasks autonomously:
   - Complete each task
   - Run tests
   - Commit
   - Update plan
   - Continue immediately to next task
   - Only stop if blocked

Start now.
```

## Step 6: Walk Away

Claude will:
- Generate the full implementation plan
- Start building task by task
- Commit after each task
- Track progress in IMPLEMENTATION_PLAN.md

Check back periodically. If stopped, just say: `Continue.`

---

## Template Files

| File | Purpose | You Edit? |
|------|---------|-----------|
| `PROMPT.md` | Your project description | **YES** |
| `PRD.json` | Structured requirements | **YES** |
| `CLAUDE.md` | AI instructions | Auto-filled |
| `IMPLEMENTATION_PLAN.md` | Task queue | Auto-generated |
| `AGENTS.md` | Quick reference | No |
| `QUICKSTART.md` | This guide | No |
| `.gitignore` | Git ignores | No |
| `docker-compose.yml` | Local databases | Modify if needed |
| `.env.example` | Env template | Copy to .env |

---

## Tips

### Be Specific in PROMPT.md
Bad: "Build a todo app"
Good: "Build a task manager with projects, due dates, priority levels, and team sharing"

### Define Data Models in PRD.json
The more specific your data models, the better the database design.

### Start Simple
Don't over-specify. Let Claude make reasonable decisions. You can always adjust.
