# Ralph Build Template

A reusable template for autonomous AI-driven development using the Ralph workflow.

## What is Ralph?

Ralph is an autonomous AI development methodology:
- One task at a time
- Tests must pass before commit
- Progress tracked in IMPLEMENTATION_PLAN.md
- AI continues automatically until blocked

## Quick Start

1. **Copy this template**
   ```bash
   cp -r D:/RalphTemplate D:/MyNewProject
   cd D:/MyNewProject
   ```

2. **Fill in your project details**
   - Edit `PROMPT.md` - describe what you're building
   - Edit `PRD.json` - structure your requirements

3. **Run the loop**
   ```powershell
   # Windows PowerShell
   .\loop.ps1

   # Windows CMD
   loop.bat

   # Mac/Linux
   ./loop.sh
   ```

4. **Walk away** - the loop handles everything

Press `Ctrl+C` to stop.

## Files to Edit

| File | What to do |
|------|------------|
| `PROMPT.md` | Describe your project |
| `PRD.json` | Define requirements |

## Files Auto-Generated

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI instructions (auto-filled) |
| `IMPLEMENTATION_PLAN.md` | Task queue (auto-generated) |

## Read More

See `QUICKSTART.md` for detailed instructions.
