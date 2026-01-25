# Ralph Autonomous Loop (PowerShell)
# Runs Claude Code continuously until manually stopped (Ctrl+C)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Green
Write-Host "   Ralph Autonomous Build Loop" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Project: $PWD" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# Check if first run
$commitCount = 0
try {
    $commitCount = [int](git rev-list --count HEAD 2>$null)
} catch {
    $commitCount = 0
}

if ($commitCount -le 1) {
    Write-Host "First run detected - generating implementation plan..." -ForegroundColor Yellow
    Write-Host ""

    $initialPrompt = @"
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
"@

    $initialPrompt | claude --print
} else {
    Write-Host "Resuming Ralph workflow..." -ForegroundColor Green
    Write-Host ""
}

# Main loop
$iteration = 1

while ($true) {
    Write-Host ""
    Write-Host "--- Iteration $iteration ---" -ForegroundColor Green
    Write-Host ""

    $continuePrompt = "Continue Ralph workflow. Complete the next task, commit, update plan, then continue to the next task. Only stop if blocked."

    try {
        $continuePrompt | claude --print
    } catch {
        Write-Host ""
        Write-Host "Claude encountered an error" -ForegroundColor Red
        Write-Host "Waiting 10 seconds before retry..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }

    # Small delay between iterations
    Start-Sleep -Seconds 2

    $iteration++
}
