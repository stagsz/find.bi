@echo off
setlocal enabledelayedexpansion

:: Ralph Loop Script (Windows Batch)
:: Autonomous AI coding loop
:: Based on Geoff Huntley's Ralph methodology

cd /d "%~dp0"

:: Configuration
set DEFAULT_MODEL=opus
set MAX_ITERATIONS=0
set ITERATION=0

:: Mode selection
set MODE=%1
if "%MODE%"=="" set MODE=build

if /i "%MODE%"=="plan" goto :plan_mode
if /i "%MODE%"=="planning" goto :plan_mode
if /i "%MODE%"=="build" goto :build_mode
if /i "%MODE%"=="building" goto :build_mode

:: Check if first arg is a number (max iterations)
echo %MODE%| findstr /r "^[0-9]*$" >nul
if %errorlevel%==0 (
    set MAX_ITERATIONS=%MODE%
    set PROMPT_FILE=PROMPT_Build.md
    echo [32m🔨 BUILDING MODE[0m - Max %MODE% iterations
    goto :check_files
)

echo [31mUnknown mode: %MODE%[0m
echo Usage: loop.bat [plan^|build] [max_iterations]
echo   loop.bat           # Build mode, unlimited
echo   loop.bat plan      # Planning mode
echo   loop.bat build 20  # Build mode, max 20 iterations
echo   loop.bat 20        # Build mode, max 20 iterations
exit /b 1

:plan_mode
set PROMPT_FILE=PROMPT_Plan.md
echo [34m🗺️  PLANNING MODE[0m - Generating/updating implementation plan
if not "%2"=="" set MAX_ITERATIONS=%2
goto :check_files

:build_mode
set PROMPT_FILE=PROMPT_Build.md
echo [32m🔨 BUILDING MODE[0m - Implementing from plan
if not "%2"=="" set MAX_ITERATIONS=%2
goto :check_files

:check_files
if not exist "%PROMPT_FILE%" (
    echo [31mError: %PROMPT_FILE% not found[0m
    exit /b 1
)

if not exist "AGENTS.md" (
    echo [31mError: AGENTS.md not found[0m
    exit /b 1
)

:: Main loop
echo [33mStarting Ralph loop...[0m
echo Press Ctrl+C to stop
echo ---

:loop
set /a ITERATION+=1

:: Check max iterations
if %MAX_ITERATIONS% gtr 0 (
    if %ITERATION% gtr %MAX_ITERATIONS% (
        echo [33mMax iterations ^(%MAX_ITERATIONS%^) reached. Stopping.[0m
        goto :done
    )
)

echo [34m═══════════════════════════════════════════════════════════[0m
echo [32mIteration %ITERATION%[0m %date% %time%
echo [34m═══════════════════════════════════════════════════════════[0m

set LOG_FILE=ralph_log_%date:~-4%%date:~4,2%%date:~7,2%.txt

echo Starting Claude at %time%... >> "%LOG_FILE%"
echo Starting Claude at %time%...

:: Run Claude with the prompt
type "%PROMPT_FILE%" | claude -p --dangerously-skip-permissions --model %DEFAULT_MODEL% --verbose 2>&1 | tee -a "%LOG_FILE%"
set EXIT_CODE=%errorlevel%

echo Claude finished at %time% with exit code %EXIT_CODE% >> "%LOG_FILE%"
echo Claude finished at %time% with exit code %EXIT_CODE%

if %EXIT_CODE% neq 0 (
    echo [31mClaude exited with code %EXIT_CODE%[0m
    echo Check %LOG_FILE% for details
    echo Continuing to next iteration in 5 seconds...
    timeout /t 5 /nobreak >nul
)

echo.
echo [32mIteration %ITERATION% complete. Starting fresh context...[0m
echo.

:: Small delay between iterations
timeout /t 2 /nobreak >nul

goto :loop

:done
echo [32mRalph loop completed after %ITERATION% iterations.[0m
