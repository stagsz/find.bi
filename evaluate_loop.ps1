# Ralph Template - Evaluation Loop
# Runs code quality and security evaluations periodically alongside Ralph
# Auto-detects project structure (Python, Node, or both)
# Usage: .\evaluate_loop.ps1 [-IntervalMinutes 10]

param(
    [int]$IntervalMinutes = 10,
    [int]$MaxRuns = 0
)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

$DATE = Get-Date -Format "yyyyMMdd"
$PROTOCOL_FILE = "evaluation_protocol_$DATE.md"

# =============================================================================
# Auto-detect project structure
# =============================================================================
$hasPython = (Test-Path "*.py") -or (Test-Path "backend") -or (Test-Path "src/*.py") -or (Test-Path "requirements.txt") -or (Test-Path "pyproject.toml")
$hasNode = (Test-Path "package.json") -or (Test-Path "frontend/package.json")
$pythonDir = if (Test-Path "backend") { "backend" } elseif (Test-Path "src") { "src" } else { "." }
$nodeDir = if (Test-Path "frontend/package.json") { "frontend" } else { "." }

# Initialize protocol file with header
$header = "# Evaluation Protocol - Ralph Build`n`n"
$header += "**Date**: $(Get-Date -Format 'yyyy-MM-dd')`n"
$header += "**Evaluation Interval**: $IntervalMinutes minutes`n`n"
$header += "This protocol tracks automated code quality and security evaluations`n"
$header += "running alongside the Ralph autonomous development loop.`n`n"
$header += "## Detected Project Structure`n`n"
$header += "- Python: $(if ($hasPython) { 'Yes (' + $pythonDir + ')' } else { 'No' })`n"
$header += "- Node.js: $(if ($hasNode) { 'Yes (' + $nodeDir + ')' } else { 'No' })`n`n"
$header += "## Checks Performed`n`n"
$header += "| Category | Checks |`n"
$header += "|----------|--------|`n"
if ($hasPython) {
    $header += "| Python | MyPy, Ruff, Pytest |`n"
}
if ($hasNode) {
    $header += "| Node.js | TypeScript, ESLint, Tests |`n"
}
$header += "| Security | Hardcoded Secrets, Prompt Injection |`n"
$header += "| Git | Working tree status |`n`n"
$header += "---`n"

$header | Out-File -FilePath $PROTOCOL_FILE -Encoding UTF8

Write-Host "================================================================" -ForegroundColor Blue
Write-Host "       Ralph Template - Evaluation Loop Started                 " -ForegroundColor Blue
Write-Host "================================================================" -ForegroundColor Blue
Write-Host "  Interval: $IntervalMinutes minutes" -ForegroundColor Blue
Write-Host "  Protocol: $PROTOCOL_FILE" -ForegroundColor Blue
Write-Host "  Python:   $(if ($hasPython) { $pythonDir } else { 'not detected' })" -ForegroundColor $(if ($hasPython) { "Green" } else { "Gray" })
Write-Host "  Node.js:  $(if ($hasNode) { $nodeDir } else { 'not detected' })" -ForegroundColor $(if ($hasNode) { "Green" } else { "Gray" })
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Blue
Write-Host "================================================================" -ForegroundColor Blue
Write-Host ""

$runCount = 0

while ($true) {
    $runCount++

    if (($MaxRuns -gt 0) -and ($runCount -gt $MaxRuns)) {
        Write-Host "Max runs ($MaxRuns) reached. Stopping." -ForegroundColor Yellow
        break
    }

    Write-Host "===============================================================" -ForegroundColor Cyan
    Write-Host "Evaluation Run #$runCount - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
    Write-Host "===============================================================" -ForegroundColor Cyan

    $runReport = "`n`n## Run #$runCount - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n"
    $hasErrors = $false

    # =========================================================================
    # Python Checks
    # =========================================================================
    if ($hasPython) {
        Write-Host "[Python] Running checks in $pythonDir..." -ForegroundColor Cyan
        $runReport += "### Python ($pythonDir)`n`n"

        # MyPy (if installed)
        Write-Host "  - MyPy type checking..." -ForegroundColor Gray
        $mypy = mypy $pythonDir 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            $runReport += "- [x] MyPy: PASS`n"
        } elseif ($mypy -match "not found|not recognized") {
            $runReport += "- [ ] MyPy: SKIPPED (not installed)`n"
        } else {
            $runReport += "- [ ] MyPy: FAIL`n"
            $hasErrors = $true
        }

        # Ruff (if installed)
        Write-Host "  - Ruff linting..." -ForegroundColor Gray
        $ruff = ruff check $pythonDir 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            $runReport += "- [x] Ruff: PASS`n"
        } elseif ($ruff -match "not found|not recognized") {
            $runReport += "- [ ] Ruff: SKIPPED (not installed)`n"
        } else {
            $runReport += "- [ ] Ruff: FAIL`n"
            $hasErrors = $true
        }

        # Pytest (if installed and tests exist)
        Write-Host "  - Pytest..." -ForegroundColor Gray
        $hasTests = (Test-Path "tests") -or (Test-Path "$pythonDir/tests") -or (Test-Path "test_*.py")
        if ($hasTests) {
            $pytest = pytest --tb=short 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                $runReport += "- [x] Pytest: PASS`n"
            } elseif ($pytest -match "not found|not recognized") {
                $runReport += "- [ ] Pytest: SKIPPED (not installed)`n"
            } else {
                $runReport += "- [ ] Pytest: FAIL`n"
                $hasErrors = $true
            }
        } else {
            $runReport += "- [ ] Pytest: SKIPPED (no tests found)`n"
        }

        $runReport += "`n"
    }

    # =========================================================================
    # Node.js Checks
    # =========================================================================
    if ($hasNode) {
        Write-Host "[Node.js] Running checks in $nodeDir..." -ForegroundColor Cyan
        $runReport += "### Node.js ($nodeDir)`n`n"

        Push-Location $nodeDir

        # Check what npm scripts are available
        $packageJson = Get-Content "package.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue
        $scripts = if ($packageJson.scripts) { $packageJson.scripts.PSObject.Properties.Name } else { @() }

        # TypeScript
        Write-Host "  - TypeScript..." -ForegroundColor Gray
        if ($scripts -contains "typecheck" -or $scripts -contains "tsc") {
            $scriptName = if ($scripts -contains "typecheck") { "typecheck" } else { "tsc" }
            $null = npm run $scriptName 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                $runReport += "- [x] TypeScript: PASS`n"
            } else {
                $runReport += "- [ ] TypeScript: FAIL`n"
                $hasErrors = $true
            }
        } else {
            $runReport += "- [ ] TypeScript: SKIPPED (no typecheck script)`n"
        }

        # ESLint
        Write-Host "  - ESLint..." -ForegroundColor Gray
        if ($scripts -contains "lint") {
            $null = npm run lint 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                $runReport += "- [x] ESLint: PASS`n"
            } else {
                $runReport += "- [ ] ESLint: FAIL`n"
                $hasErrors = $true
            }
        } else {
            $runReport += "- [ ] ESLint: SKIPPED (no lint script)`n"
        }

        # Tests
        Write-Host "  - Tests..." -ForegroundColor Gray
        if ($scripts -contains "test") {
            $null = npm test 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                $runReport += "- [x] Tests: PASS`n"
            } else {
                $runReport += "- [ ] Tests: FAIL`n"
                $hasErrors = $true
            }
        } else {
            $runReport += "- [ ] Tests: SKIPPED (no test script)`n"
        }

        Pop-Location
        $runReport += "`n"
    }

    # =========================================================================
    # Security Checks
    # =========================================================================
    Write-Host "[Security] Running checks..." -ForegroundColor Cyan
    $runReport += "### Security`n`n"

    # Hardcoded secrets check
    Write-Host "  - Checking for hardcoded secrets..." -ForegroundColor Gray
    $secretPatterns = @(
        'password\s*=\s*[''"][^''"]+[''"]',
        'api_key\s*=\s*[''"][^''"]+[''"]',
        'secret\s*=\s*[''"][^''"]+[''"]',
        'ANTHROPIC_API_KEY\s*=\s*[''"]sk-',
        'OPENAI_API_KEY\s*=\s*[''"]sk-'
    )
    $secretsFound = $false
    foreach ($pattern in $secretPatterns) {
        $foundSecrets = Get-ChildItem -Recurse -Include "*.py","*.ts","*.js","*.env" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*venv*" -and $_.Name -ne ".env.example" } |
            Select-String -Pattern $pattern -ErrorAction SilentlyContinue
        if ($foundSecrets) { $secretsFound = $true; break }
    }
    if (-not $secretsFound) {
        $runReport += "- [x] Hardcoded Secrets: PASS`n"
    } else {
        $runReport += "- [ ] Hardcoded Secrets: FAIL (potential secrets found)`n"
        $hasErrors = $true
    }

    # Prompt Injection Check
    Write-Host "  - Prompt injection scan..." -ForegroundColor Gray
    if (Test-Path ".\check_prompt_injection.ps1") {
        & .\check_prompt_injection.ps1 -OutputFile "prompt_injection_report.md" | Out-Null
        $report = Get-Content "prompt_injection_report.md" -Raw -ErrorAction SilentlyContinue
        if ($report -match "Total.*\*\*0\*\*" -or $report -match "No prompt injection vulnerabilities") {
            $runReport += "- [x] Prompt Injection: PASS`n"
        } else {
            $runReport += "- [ ] Prompt Injection: WARNINGS (see prompt_injection_report.md)`n"
        }
    } else {
        $runReport += "- [ ] Prompt Injection: SKIPPED (scanner not found)`n"
    }

    $runReport += "`n"

    # =========================================================================
    # Git Status
    # =========================================================================
    Write-Host "[Git] Checking status..." -ForegroundColor Cyan
    $runReport += "### Git`n`n"

    $gitStatus = git status --porcelain 2>&1
    if ([string]::IsNullOrWhiteSpace($gitStatus)) {
        $runReport += "- [x] Working tree: Clean`n"
    } else {
        $changedFiles = ($gitStatus -split "`n" | Where-Object { $_ }).Count
        $runReport += "- [ ] Working tree: $changedFiles uncommitted changes`n"
    }

    $runReport += "`n"

    # =========================================================================
    # Summary
    # =========================================================================
    if ($hasErrors) {
        $runReport += "**Status**: Issues found - review required`n"
        Write-Host "Status: Issues found" -ForegroundColor Yellow
    } else {
        $runReport += "**Status**: All checks passed`n"
        Write-Host "Status: All checks passed" -ForegroundColor Green
    }

    # Append to protocol file
    $runReport | Out-File -FilePath $PROTOCOL_FILE -Append -Encoding UTF8

    Write-Host ""
    Write-Host "Report appended to: $PROTOCOL_FILE" -ForegroundColor Gray
    Write-Host "Next evaluation in $IntervalMinutes minutes..." -ForegroundColor Gray
    Write-Host ""

    # Wait for next interval
    Start-Sleep -Seconds ($IntervalMinutes * 60)
}

Write-Host "Evaluation loop completed after $runCount runs." -ForegroundColor Green
