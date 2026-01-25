@echo off
setlocal enabledelayedexpansion

:: Ralph Autonomous Loop (Windows)
:: Runs Claude Code continuously until manually stopped (Ctrl+C)

cd /d "%~dp0"

echo ========================================
echo    Ralph Autonomous Build Loop
echo ========================================
echo.
echo Project: %CD%
echo Press Ctrl+C to stop
echo.

:: Count commits to check if first run
for /f %%i in ('git rev-list --count HEAD 2^>nul') do set COMMIT_COUNT=%%i
if "%COMMIT_COUNT%"=="" set COMMIT_COUNT=0

if %COMMIT_COUNT% LEQ 1 (
    echo First run detected - generating implementation plan...
    echo.

    :: First run - generate plan and start
    (
        echo Read PROMPT.md and PRD.json.
        echo.
        echo 1. Generate a complete IMPLEMENTATION_PLAN.md with:
        echo    - Tasks broken into logical phases
        echo    - Each task completable in 1-2 hours max
        echo    - Task IDs with prefixes ^(SETUP-, DB-, API-, UI-, AUTH-, etc^)
        echo    - Update the Current Status section
        echo.
        echo 2. Update CLAUDE.md with:
        echo    - Project overview filled in
        echo    - Tech stack table completed
        echo    - Domain knowledge section populated
        echo.
        echo 3. Begin Ralph workflow - implement tasks autonomously:
        echo    - Complete each task
        echo    - Run tests
        echo    - Commit
        echo    - Update plan
        echo    - Continue immediately to next task
        echo    - Only stop if blocked
        echo.
        echo Start now.
    ) | claude --print

) else (
    echo Resuming Ralph workflow...
    echo.
)

:: Main loop
set ITERATION=1

:loop
echo.
echo --- Iteration %ITERATION% ---
echo.

:: Run Claude with continue prompt
echo Continue Ralph workflow. Complete the next task, commit, update plan, then continue to the next task. Only stop if blocked. | claude --print

:: Check for errors
if errorlevel 1 (
    echo.
    echo Claude exited with an error
    echo Waiting 10 seconds before retry...
    timeout /t 10 /nobreak >nul
)

:: Small delay between iterations
timeout /t 2 /nobreak >nul

set /a ITERATION+=1
goto loop
