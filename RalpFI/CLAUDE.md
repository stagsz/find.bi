# CLAUDE.md

## Ralph Workflow (Brownfield)

This project uses the **Ralph autonomous AI methodology** on an **existing codebase**.

### Brownfield Rules

1. **Analyze before modifying** - Understand existing patterns first
2. **ONE task per iteration** - Never multi-task
3. **Tests MUST pass** - No commits with failing tests
4. **Follow existing patterns** - Match the style of existing code exactly
5. **Update the plan** - Mark tasks [x] with commit hash after each commit
6. **Sequential execution** - Never skip ahead

### The Loop

```
1. Read IMPLEMENTATION_PLAN.md
2. Find next unchecked [ ] task
3. Implement ONLY that task (in the TARGET codebase)
4. Run tests and linters
5. If passing → commit
6. Mark task [x] with commit hash
7. IMMEDIATELY continue to next task
8. Only stop if blocked
```

### Quality Gates

Run before every commit:

```bash
cd D:\RalphTemplate\RalpFI
python -m py_compile main.py
python -m py_compile src/f1_data.py
python -m py_compile src/arcade_replay.py
# Add more as files are created
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

**F1 Live Race Prediction** - Adding real-time predictive analytics to the F1 Race Replay application. Forecasts win probabilities, optimal pit windows, and position changes during race replays.

---

## Target Codebase

**Location:** `D:\RalphTemplate\RalpFI`

### Existing Structure
```
RalpFI/
├── main.py                 # Entry point
├── src/
│   ├── f1_data.py          # Telemetry loading & processing
│   ├── arcade_replay.py    # Visualization launcher
│   ├── ui_components.py    # UI elements (65KB - large file)
│   ├── interfaces/
│   │   ├── race_replay.py  # Race window (main integration point)
│   │   └── qualifying.py   # Qualifying interface
│   ├── cli/                # CLI menu
│   ├── gui/                # Qt GUI menu
│   └── lib/
│       ├── tyres.py        # Tyre definitions
│       └── time.py         # Time utilities
├── computed_data/          # Cached telemetry
└── .fastf1-cache/          # FastF1 cache
```

### Key Integration Points
- `src/interfaces/race_replay.py` - Add prediction panel here
- `src/ui_components.py` - Add prediction UI components
- `src/f1_data.py` - May need to extract additional telemetry

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Visualization | Arcade (Python game framework) |
| F1 Data | FastF1 |
| GUI | PySide6 |
| Data Processing | pandas, numpy |
| **New: Predictions** | scikit-learn, scipy |

---

## Domain Knowledge

### F1 Terminology
- **Undercut**: Pitting before rival to gain track position
- **Overcut**: Staying out longer to gain on worn tyres
- **DRS**: Drag Reduction System (rear wing opens in zones)
- **Pit window**: Optimal lap range for pit stop
- **Tyre deg**: Rate of tyre performance degradation

### FastF1 Data Available
- Lap times, sector times
- Tyre compound and age
- Position data (X, Y coordinates)
- Speed, gear, throttle, brake telemetry
- Pit stop events
