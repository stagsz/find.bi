#!/bin/bash

# Ralph Autonomous Loop
# Runs Claude Code continuously until manually stopped (Ctrl+C)

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Ralph Autonomous Build Loop${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Project: ${YELLOW}$PROJECT_DIR${NC}"
echo -e "Press ${RED}Ctrl+C${NC} to stop"
echo ""

# Check if this is first run (no commits beyond initial)
COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")

if [ "$COMMIT_COUNT" -le "1" ]; then
    echo -e "${YELLOW}First run detected - generating implementation plan...${NC}"
    echo ""

    INITIAL_PROMPT="Read PROMPT.md and PRD.json.

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

Start now."

    echo "$INITIAL_PROMPT" | claude --print
else
    echo -e "${GREEN}Resuming Ralph workflow...${NC}"
    echo ""
fi

# Main loop
ITERATION=1
while true; do
    echo ""
    echo -e "${GREEN}--- Iteration $ITERATION ---${NC}"
    echo ""

    # Run Claude with continue prompt
    # --print outputs response to terminal
    # Using heredoc to send the continue command
    echo "Continue Ralph workflow. Complete the next task, commit, update plan, then continue to the next task. Only stop if blocked." | claude --print

    # Check exit code
    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
        echo ""
        echo -e "${RED}Claude exited with code $EXIT_CODE${NC}"
        echo -e "${YELLOW}Waiting 10 seconds before retry...${NC}"
        sleep 10
    fi

    # Small delay between iterations to avoid rate limits
    sleep 2

    ITERATION=$((ITERATION + 1))
done
