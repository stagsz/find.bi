#!/bin/bash
# find.bi - Interactive Project Setup (Bash version)
# Walks you through setting up a new project from this template

set -e

echo "================================================================"
echo "               find.bi - New Project Setup                      "
echo "================================================================"
echo ""
echo "This wizard will help you configure a new project."
echo ""

# Step 1: Project Basics
echo "Step 1: Project Basics"
echo "----------------------"
echo ""

read -p "What is your project name? (e.g., 'TaskManager', 'MyBlog'): " projectName
while [ -z "$projectName" ]; do
    echo "Project name is required."
    read -p "What is your project name?: " projectName
done

read -p "Brief description (one sentence): " projectDesc
while [ -z "$projectDesc" ]; do
    echo "Description is required."
    read -p "Brief description: " projectDesc
done

echo ""

# Step 2: Project Type
echo "Step 2: Project Type"
echo "--------------------"
echo ""
echo "What type of project is this?"
echo "  1) Full-stack web app (Frontend + Backend + Database)"
echo "  2) Backend API only (No frontend)"
echo "  3) Frontend only (No backend)"
echo "  4) CLI tool / Script"
echo "  5) Desktop application"
echo "  6) Other"
echo ""

read -p "Enter number (1-6): " projectType
hasFrontend=false
hasBackend=false
hasDatabase=false

case $projectType in
    1) hasFrontend=true; hasBackend=true; hasDatabase=true ;;
    2) hasBackend=true; hasDatabase=true ;;
    3) hasFrontend=true ;;
    4) hasBackend=true ;;
    5) hasFrontend=true ;;
    6)
        read -p "Has frontend? (y/n): " ans
        [ "$ans" = "y" ] && hasFrontend=true
        read -p "Has backend? (y/n): " ans
        [ "$ans" = "y" ] && hasBackend=true
        read -p "Has database? (y/n): " ans
        [ "$ans" = "y" ] && hasDatabase=true
        ;;
esac

echo ""

# Step 3: Tech Stack
echo "Step 3: Tech Stack"
echo "------------------"
echo ""

frontend=""
backend=""
database=""

if [ "$hasFrontend" = true ]; then
    echo "Frontend technology?"
    echo "  1) React (Vite + TypeScript)"
    echo "  2) Next.js"
    echo "  3) Vue.js"
    echo "  4) Svelte"
    echo "  5) Other"
    read -p "Enter number (1-5): " choice
    case $choice in
        1) frontend="React (Vite + TypeScript)" ;;
        2) frontend="Next.js" ;;
        3) frontend="Vue.js" ;;
        4) frontend="Svelte" ;;
        5) read -p "Specify frontend tech: " frontend ;;
        *) frontend="React (Vite + TypeScript)" ;;
    esac
    echo ""
fi

if [ "$hasBackend" = true ]; then
    echo "Backend technology?"
    echo "  1) Python (FastAPI)"
    echo "  2) Python (Django)"
    echo "  3) Node.js (Express)"
    echo "  4) Node.js (NestJS)"
    echo "  5) Other"
    read -p "Enter number (1-5): " choice
    case $choice in
        1) backend="Python (FastAPI)" ;;
        2) backend="Python (Django)" ;;
        3) backend="Node.js (Express)" ;;
        4) backend="Node.js (NestJS)" ;;
        5) read -p "Specify backend tech: " backend ;;
        *) backend="Python (FastAPI)" ;;
    esac
    echo ""
fi

if [ "$hasDatabase" = true ]; then
    echo "Database?"
    echo "  1) PostgreSQL"
    echo "  2) MongoDB"
    echo "  3) SQLite"
    echo "  4) MySQL"
    echo "  5) Other"
    read -p "Enter number (1-5): " choice
    case $choice in
        1) database="PostgreSQL" ;;
        2) database="MongoDB" ;;
        3) database="SQLite" ;;
        4) database="MySQL" ;;
        5) read -p "Specify database: " database ;;
        *) database="PostgreSQL" ;;
    esac
    echo ""
fi

# Step 4: Key Features
echo "Step 4: Key Features"
echo "--------------------"
echo ""
echo "What are the main features? (one per line, empty line to finish)"
echo "Example: 'User authentication', 'Dashboard', 'Export to CSV'"
echo ""

features=()
count=1
while true; do
    read -p "Feature $count (or press Enter to finish): " feature
    [ -z "$feature" ] && break
    features+=("$feature")
    ((count++))
done

echo ""

# Step 5: Additional Details
echo "Step 5: Additional Details"
echo "--------------------------"
echo ""

read -p "Does it need user authentication? (y/n): " ans
needsAuth=false
[ "$ans" = "y" ] && needsAuth=true

read -p "Does it need to integrate with external APIs? (y/n): " ans
needsAPI=false
[ "$ans" = "y" ] && needsAPI=true

echo ""

# Step 6: Generate Files
echo "Step 6: Generating Configuration"
echo "---------------------------------"
echo ""

# Generate PRD.json
cat > PRD.json <<EOF
{
  "project_name": "$projectName",
  "description": "$projectDesc",
  "type": "$(case $projectType in 1) echo "Full-stack web application";; 2) echo "Backend API";; 3) echo "Frontend application";; 4) echo "CLI tool";; 5) echo "Desktop application";; 6) echo "Other";; esac)",
  "tech_stack": {
    "frontend": "${frontend:-N/A}",
    "backend": "${backend:-N/A}",
    "database": "${database:-N/A}"
  },
  "features": [
$(for i in "${!features[@]}"; do
    echo "    \"${features[$i]}\"$([ $i -lt $((${#features[@]}-1)) ] && echo ",")"
done)
  ],
  "requirements": {
    "authentication": $needsAuth,
    "external_apis": $needsAPI
  },
  "notes": "Generated by setup wizard. Edit this file to add more details before running planning mode."
}
EOF

echo "[✓] Created PRD.json"

# Generate CLAUDE.md (simplified for bash)
cat > CLAUDE.md <<'EOF'
# CLAUDE.md

## Ralph Workflow

This project uses the **Ralph autonomous AI methodology**.

### Rules (Non-Negotiable)

1. **ONE task per iteration** - Never multi-task
2. **Tests MUST pass** - No commits with failing tests
3. **Follow existing patterns** - Match the style of existing code
4. **Update the plan** - Mark tasks [x] with commit hash after each commit
5. **Sequential execution** - Never skip ahead

### The Loop

```
1. Read IMPLEMENTATION_PLAN.md
2. Find next unchecked [ ] task
3. Implement ONLY that task
4. Run tests and linters
5. If passing → commit
6. Mark task [x] with commit hash
7. IMMEDIATELY continue to next task
8. Only stop if blocked
```

### Quality Gates

Run before every commit - update these based on your tech stack.

### Commit Format

```
<type>(<scope>): <description> (<TASK-ID>)

Types: feat, fix, test, refactor, docs, chore
```

### When Blocked

1. Document blocker in IMPLEMENTATION_PLAN.md under `## Blockers`
2. Stop and report
3. Do NOT skip to another task
4. Wait for user decision

---

## Project Overview

EOF

echo "**$projectName** - $projectDesc" >> CLAUDE.md
echo "" >> CLAUDE.md
echo "---" >> CLAUDE.md
echo "" >> CLAUDE.md
echo "## Tech Stack" >> CLAUDE.md
echo "" >> CLAUDE.md
echo "| Layer | Technology |" >> CLAUDE.md
echo "|-------|------------|" >> CLAUDE.md
[ -n "$frontend" ] && echo "| Frontend | $frontend |" >> CLAUDE.md
[ -n "$backend" ] && echo "| Backend | $backend |" >> CLAUDE.md
[ -n "$database" ] && echo "| Database | $database |" >> CLAUDE.md

echo "[✓] Updated CLAUDE.md"

# Rename workspace file
if [ -f "find.bi.code-workspace" ]; then
    mv "find.bi.code-workspace" "$projectName.code-workspace"
    echo "[✓] Renamed workspace to $projectName.code-workspace"
fi

echo ""

# Step 7: Summary
echo "================================================================"
echo "                    Setup Complete!                             "
echo "================================================================"
echo ""
echo "Project: $projectName"
[ -n "$frontend" ] && echo "Frontend: $frontend"
[ -n "$backend" ] && echo "Backend: $backend"
[ -n "$database" ] && echo "Database: $database"
echo ""
echo "Files created/updated:"
echo "  - PRD.json (your requirements)"
echo "  - CLAUDE.md (project context)"
echo ""
echo "================================================================"
echo "                      Next Steps                                "
echo "================================================================"
echo ""
echo "1. Review PRD.json and add more details if needed"
echo ""
echo "2. Run planning mode to generate implementation plan:"
echo "   ./loop.sh plan"
echo ""
echo "3. Review IMPLEMENTATION_PLAN.md"
echo ""
echo "4. Start building:"
echo "   ./loop.sh build"
echo ""
echo "================================================================"
echo ""
