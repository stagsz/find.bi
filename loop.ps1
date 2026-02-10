# Ralph Loop Script (PowerShell)
# Autonomous AI coding loop
# Based on Geoff Huntley's Ralph methodology

param(
    [Parameter(Position=0)]
    [string]$Mode = "build",

    [Parameter(Position=1)]
    [int]$MaxIterations = 0  # 0 = unlimited
)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

# Configuration
$DEFAULT_MODEL = "opus"
$Iteration = 0

# Mode selection
switch -Regex ($Mode) {
    "^(plan|planning)$" {
        $PROMPT_FILE = "PROMPT_Plan.md"
        Write-Host "🗺️  PLANNING MODE - Generating/updating implementation plan" -ForegroundColor Blue
    }
    "^(build|building|)$" {
        $PROMPT_FILE = "PROMPT_Build.md"
        Write-Host "🔨 BUILDING MODE - Implementing from plan" -ForegroundColor Green
    }
    "^\d+$" {
        # If first arg is a number, treat as max iterations for build mode
        $MaxIterations = [int]$Mode
        $PROMPT_FILE = "PROMPT_Build.md"
        Write-Host "🔨 BUILDING MODE - Max $MaxIterations iterations" -ForegroundColor Green
    }
    default {
        Write-Host "Unknown mode: $Mode" -ForegroundColor Red
        Write-Host "Usage: .\loop.ps1 [plan|build] [max_iterations]"
        Write-Host "  .\loop.ps1           # Build mode, unlimited"
        Write-Host "  .\loop.ps1 plan      # Planning mode"
        Write-Host "  .\loop.ps1 build 20  # Build mode, max 20 iterations"
        Write-Host "  .\loop.ps1 20        # Build mode, max 20 iterations"
        exit 1
    }
}

# Check required files exist
if (-not (Test-Path $PROMPT_FILE)) {
    Write-Host "Error: $PROMPT_FILE not found" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "AGENTS.md")) {
    Write-Host "Error: AGENTS.md not found" -ForegroundColor Red
    exit 1
}

# Main loop
Write-Host "Starting Ralph loop..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop"
Write-Host "---"

while ($true) {
    $Iteration++

    # Check max iterations
    if ($MaxIterations -gt 0 -and $Iteration -gt $MaxIterations) {
        Write-Host "Max iterations ($MaxIterations) reached. Stopping." -ForegroundColor Yellow
        break
    }

    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue
    Write-Host "Iteration $Iteration $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Blue

    $LOG_FILE = "ralph_log_$(Get-Date -Format 'yyyyMMdd').md"
    $timestamp = Get-Date -Format 'HH:mm:ss'

    "Starting Claude at $timestamp..." | Tee-Object -FilePath $LOG_FILE -Append

    # Run Claude with the prompt
    try {
        $promptContent = Get-Content $PROMPT_FILE -Raw
        $promptContent | claude -p --dangerously-skip-permissions --model $DEFAULT_MODEL --verbose 2>&1 | Tee-Object -FilePath $LOG_FILE -Append
        $EXIT_CODE = $LASTEXITCODE
    } catch {
        $EXIT_CODE = 1
        Write-Host "Error running Claude: $_" -ForegroundColor Red
    }

    $timestamp = Get-Date -Format 'HH:mm:ss'
    "Claude finished at $timestamp with exit code $EXIT_CODE" | Tee-Object -FilePath $LOG_FILE -Append

    if ($EXIT_CODE -ne 0) {
        Write-Host "Claude exited with code $EXIT_CODE" -ForegroundColor Red
        Write-Host "Check $LOG_FILE for details"
        Write-Host "Continuing to next iteration in 5 seconds..."
        Start-Sleep -Seconds 5
    }

    Write-Host ""
    Write-Host "Iteration $Iteration complete. Starting fresh context..." -ForegroundColor Green
    Write-Host ""

    # Small delay between iterations
    Start-Sleep -Seconds 2
}

Write-Host "Ralph loop completed after $Iteration iterations." -ForegroundColor Green
