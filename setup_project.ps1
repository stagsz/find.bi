# find.bi - Interactive Project Setup
# Walks you through setting up a new project from this template

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "               find.bi - New Project Setup                      " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This wizard will help you configure a new project." -ForegroundColor Gray
Write-Host ""

# =============================================================================
# Step 1: Project Basics
# =============================================================================
Write-Host "Step 1: Project Basics" -ForegroundColor Green
Write-Host "----------------------" -ForegroundColor Green
Write-Host ""

$projectName = Read-Host "What is your project name? (e.g., 'TaskManager', 'MyBlog')"
while ([string]::IsNullOrWhiteSpace($projectName)) {
    Write-Host "Project name is required." -ForegroundColor Red
    $projectName = Read-Host "What is your project name?"
}

$projectDesc = Read-Host "Brief description (one sentence)"
while ([string]::IsNullOrWhiteSpace($projectDesc)) {
    Write-Host "Description is required." -ForegroundColor Red
    $projectDesc = Read-Host "Brief description"
}

Write-Host ""

# =============================================================================
# Step 2: Project Type
# =============================================================================
Write-Host "Step 2: Project Type" -ForegroundColor Green
Write-Host "--------------------" -ForegroundColor Green
Write-Host ""
Write-Host "What type of project is this?"
Write-Host "  1) Full-stack web app (Frontend + Backend + Database)"
Write-Host "  2) Backend API only (No frontend)"
Write-Host "  3) Frontend only (No backend)"
Write-Host "  4) CLI tool / Script"
Write-Host "  5) Desktop application"
Write-Host "  6) Other"
Write-Host ""

$projectType = Read-Host "Enter number (1-6)"
$hasFrontend = $false
$hasBackend = $false
$hasDatabase = $false

switch ($projectType) {
    "1" { $hasFrontend = $true; $hasBackend = $true; $hasDatabase = $true }
    "2" { $hasBackend = $true; $hasDatabase = $true }
    "3" { $hasFrontend = $true }
    "4" { $hasBackend = $true }
    "5" { $hasFrontend = $true }
    "6" {
        $hasFrontend = (Read-Host "Has frontend? (y/n)") -match "^y"
        $hasBackend = (Read-Host "Has backend? (y/n)") -match "^y"
        $hasDatabase = (Read-Host "Has database? (y/n)") -match "^y"
    }
}

Write-Host ""

# =============================================================================
# Step 3: Tech Stack
# =============================================================================
Write-Host "Step 3: Tech Stack" -ForegroundColor Green
Write-Host "------------------" -ForegroundColor Green
Write-Host ""

$frontend = ""
$backend = ""
$database = ""

if ($hasFrontend) {
    Write-Host "Frontend technology?"
    Write-Host "  1) React (Vite + TypeScript)"
    Write-Host "  2) Next.js"
    Write-Host "  3) Vue.js"
    Write-Host "  4) Svelte"
    Write-Host "  5) Other"
    $choice = Read-Host "Enter number (1-5)"
    $frontend = switch ($choice) {
        "1" { "React (Vite + TypeScript)" }
        "2" { "Next.js" }
        "3" { "Vue.js" }
        "4" { "Svelte" }
        "5" { Read-Host "Specify frontend tech" }
        default { "React (Vite + TypeScript)" }
    }
    Write-Host ""
}

if ($hasBackend) {
    Write-Host "Backend technology?"
    Write-Host "  1) Python (FastAPI)"
    Write-Host "  2) Python (Django)"
    Write-Host "  3) Node.js (Express)"
    Write-Host "  4) Node.js (NestJS)"
    Write-Host "  5) Other"
    $choice = Read-Host "Enter number (1-5)"
    $backend = switch ($choice) {
        "1" { "Python (FastAPI)" }
        "2" { "Python (Django)" }
        "3" { "Node.js (Express)" }
        "4" { "Node.js (NestJS)" }
        "5" { Read-Host "Specify backend tech" }
        default { "Python (FastAPI)" }
    }
    Write-Host ""
}

if ($hasDatabase) {
    Write-Host "Database?"
    Write-Host "  1) PostgreSQL"
    Write-Host "  2) MongoDB"
    Write-Host "  3) SQLite"
    Write-Host "  4) MySQL"
    Write-Host "  5) Other"
    $choice = Read-Host "Enter number (1-5)"
    $database = switch ($choice) {
        "1" { "PostgreSQL" }
        "2" { "MongoDB" }
        "3" { "SQLite" }
        "4" { "MySQL" }
        "5" { Read-Host "Specify database" }
        default { "PostgreSQL" }
    }
    Write-Host ""
}

# =============================================================================
# Step 4: Key Features
# =============================================================================
Write-Host "Step 4: Key Features" -ForegroundColor Green
Write-Host "--------------------" -ForegroundColor Green
Write-Host ""
Write-Host "What are the main features? (one per line, empty line to finish)"
Write-Host "Example: 'User authentication', 'Dashboard', 'Export to CSV'"
Write-Host ""

$features = @()
while ($true) {
    $feature = Read-Host "Feature $($features.Count + 1) (or press Enter to finish)"
    if ([string]::IsNullOrWhiteSpace($feature)) { break }
    $features += $feature
}

if ($features.Count -eq 0) {
    Write-Host "No features specified. You can add them later to PRD.json" -ForegroundColor Yellow
}

Write-Host ""

# =============================================================================
# Step 5: Additional Details
# =============================================================================
Write-Host "Step 5: Additional Details" -ForegroundColor Green
Write-Host "--------------------------" -ForegroundColor Green
Write-Host ""

$needsAuth = (Read-Host "Does it need user authentication? (y/n)") -match "^y"
$needsAPI = (Read-Host "Does it need to integrate with external APIs? (y/n)") -match "^y"

Write-Host ""

# =============================================================================
# Step 6: Generate Files
# =============================================================================
Write-Host "Step 6: Generating Configuration" -ForegroundColor Green
Write-Host "---------------------------------" -ForegroundColor Green
Write-Host ""

# Generate PRD.json
$prd = @{
    project_name = $projectName
    description = $projectDesc
    type = switch ($projectType) {
        "1" { "Full-stack web application" }
        "2" { "Backend API" }
        "3" { "Frontend application" }
        "4" { "CLI tool" }
        "5" { "Desktop application" }
        "6" { "Other" }
    }
    tech_stack = @{
        frontend = if ($frontend) { $frontend } else { "N/A" }
        backend = if ($backend) { $backend } else { "N/A" }
        database = if ($database) { $database } else { "N/A" }
    }
    features = $features
    requirements = @{
        authentication = $needsAuth
        external_apis = $needsAPI
    }
    notes = "Generated by setup wizard. Edit this file to add more details before running planning mode."
}

$prdJson = $prd | ConvertTo-Json -Depth 10
$prdJson | Out-File -FilePath "PRD.json" -Encoding UTF8

Write-Host "[✓] Created PRD.json" -ForegroundColor Green

# Update CLAUDE.md
$claudeMd = @"
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

Run before every commit:

```bash
$(if ($backend -match "Python") {
"# Backend (Python)
cd backend && mypy app && ruff check app && pytest"
} elseif ($backend -match "Node") {
"# Backend (Node.js)
cd backend && npm run typecheck && npm run lint && npm test"
} else {
"# Backend
# (Add your quality gate commands here)"
})

$(if ($hasFrontend) {
"# Frontend
cd frontend && npm run typecheck && npm run lint && npm test"
} else {
"# No frontend"
})
```

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

**$projectName** - $projectDesc

---

## Tech Stack

| Layer | Technology |
|-------|------------|
$(if ($frontend) { "| Frontend | $frontend |`n" } else { "" })$(if ($backend) { "| Backend | $backend |`n" } else { "" })$(if ($database) { "| Database | $database |`n" } else { "" })$(if ($needsAuth) { "| Auth | (To be determined) |`n" } else { "" })

---

## Domain Knowledge

<!-- Add domain-specific terms, conventions, data formats here -->

$(if ($needsAPI) { "### External API Integrations`n`n(Document API endpoints, authentication methods, rate limits)`n`n" } else { "" })
"@

$claudeMd | Out-File -FilePath "CLAUDE.md" -Encoding UTF8
Write-Host "[✓] Updated CLAUDE.md" -ForegroundColor Green

# Update workspace file name
if (Test-Path "find.bi.code-workspace") {
    $workspaceContent = Get-Content "find.bi.code-workspace" -Raw
    $newWorkspaceName = "$projectName.code-workspace"
    $workspaceContent | Out-File -FilePath $newWorkspaceName -Encoding UTF8
    Remove-Item "find.bi.code-workspace"
    Write-Host "[✓] Renamed workspace to $newWorkspaceName" -ForegroundColor Green
}

Write-Host ""

# =============================================================================
# Step 7: Summary & Next Steps
# =============================================================================
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                    Setup Complete!                             " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $projectName" -ForegroundColor White
Write-Host "Type: $($prd.type)" -ForegroundColor White
if ($frontend) { Write-Host "Frontend: $frontend" -ForegroundColor White }
if ($backend) { Write-Host "Backend: $backend" -ForegroundColor White }
if ($database) { Write-Host "Database: $database" -ForegroundColor White }
Write-Host ""
Write-Host "Files created/updated:" -ForegroundColor Gray
Write-Host "  - PRD.json (your requirements)" -ForegroundColor Gray
Write-Host "  - CLAUDE.md (project context)" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                      Next Steps                                " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review PRD.json and add more details if needed" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Run planning mode to generate implementation plan:" -ForegroundColor Yellow
Write-Host "   .\loop.ps1 plan" -ForegroundColor White
Write-Host ""
Write-Host "3. Review IMPLEMENTATION_PLAN.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Start building:" -ForegroundColor Yellow
Write-Host "   .\loop.ps1 build" -ForegroundColor White
Write-Host ""
Write-Host "5. (Optional) Run evaluation loop in separate terminal:" -ForegroundColor Yellow
Write-Host "   .\evaluate_loop.ps1" -ForegroundColor White
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
