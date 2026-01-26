# Implementation Plan - F1 Live Race Prediction

> **Ralph Workflow**: Do tasks in order. One at a time. Update this file after each commit.

## Current Status

**Phase**: 8 - Testing & Polish
**Progress**: 35 / 36 tasks
**Last Completed**: TEST-02 (c0253cc)
**Ready to Start**: TEST-03 (BLOCKED - requires manual visual testing)

---

## Project: F1 Live Race Prediction

**Type**: Brownfield (adding to existing codebase)
**Target**: `D:\RalphTemplate\RalpFI`

### Codebase Analysis Summary (Completed)

**Architecture Patterns Identified:**
- UI components inherit from `BaseComponent` (ui_components.py:19-22)
- Standard component methods: `on_resize(window)`, `draw(window)`, `on_mouse_press(window, x, y, button, modifiers) -> bool`
- Visibility managed via `_visible` property + `toggle_visibility()` method
- Frame data at 25 FPS, resampled from FastF1 telemetry (f1_data.py:24)
- Pickle caching for computed data (f1_data.py:421-428)

**Key Integration Points:**
- `F1RaceReplayWindow.__init__` (race_replay.py:22-129) - Initialize components
- `on_draw()` (race_replay.py:269-447) - Render components
- `on_update()` (race_replay.py:449-456) - Update logic
- `on_key_press()` (race_replay.py:458-494) - Keyboard handlers
- `on_mouse_press()` (race_replay.py:496-505) - Mouse event delegation

**Available Prediction Data Per Frame:**
- Position, speed (km/h), lap number, tyre compound (0-4)
- DRS state (>=10 = active), throttle %, brake %
- Race distance (meters), relative lap progress (0-1)
- Weather: track/air temp, humidity, wind, rain state

### Features to Build
1. **PRED-01**: Win Probability Display - Real-time win probability for each driver
2. **PRED-02**: Pit Window Predictor - Optimal pit windows with "pit now" recommendations
3. **PRED-03**: Position Change Alerts - Imminent overtake predictions and danger zones
4. **PRED-04**: Prediction Overlay Panel - Toggleable UI panel for all predictions

---

## Phase 0: Discovery & Setup

### Codebase Analysis

- [x] DISC-01: Document existing UI component patterns from ui_components.py (fe8f156)
  - **File**: `D:\RalphTemplate\RalpFI\src\ui_components.py` (1547 lines)
  - **Output**: Create `D:\RalphTemplate\RalpFI\src\predictions\PATTERNS.md` documenting:
    - BaseComponent class: `on_resize(window)`, `draw(window)`, `on_mouse_press(window, x, y, button, modifiers) -> bool`
    - Visibility pattern: `_visible` property, `@property visible`, `toggle_visibility() -> bool`, `set_visible()`
    - COLORS dict pattern (see RaceProgressBarComponent.COLORS for reference)
    - Text rendering: `arcade.Text(text, x, y, color, size, bold=, anchor_x=, anchor_y=).draw()`
    - Rect drawing: `arcade.XYWH(cx, cy, w, h)`, `arcade.draw_rect_filled()`, `arcade.draw_rect_outline()`

- [x] DISC-02: Document data structures in f1_data.py (036e3fb)
  - **File**: `D:\RalphTemplate\RalpFI\src\f1_data.py` (878 lines)
  - **Output**: Add notes to `D:\RalphTemplate\RalpFI\src\predictions\PATTERNS.md` documenting:
    - Frame structure (verified from line 375-388):
      ```python
      frame = {
          "t": float,           # timestamp in seconds from race start
          "lap": int,           # leader's current lap
          "drivers": {
              "VER": {
                  "x": float, "y": float,           # world coordinates
                  "dist": float,                     # race distance (metres)
                  "lap": int,                        # driver's current lap
                  "rel_dist": float,                 # 0-1 within lap
                  "tyre": float,                     # compound (0=SOFT, 1=MED, 2=HARD, 3=INTER, 4=WET)
                  "position": int,                   # current race position
                  "speed": float, "gear": int,      # telemetry
                  "drs": int,                        # >=10 means DRS active
                  "throttle": float, "brake": float
              }, ...
          },
          "weather": {...}  # optional: track_temp, air_temp, humidity, wind_speed, wind_direction, rain_state
      }
      ```
    - FPS=25, DT=1/25 (line 24-25)
    - Track status codes: "1"=Green, "2"=Yellow, "4"=SC, "5"=Red, "6"/"7"=VSC

- [x] DISC-03: Map integration points in race_replay.py (3f3a321)
  - **File**: `D:\RalphTemplate\RalpFI\src\interfaces\race_replay.py` (510 lines)
  - **Output**: Add notes to `D:\RalphTemplate\RalpFI\src\predictions\PATTERNS.md` documenting:
    - Component init: After line 71 (race_controls_comp), add prediction components
    - Resize registration: Line 231 - add to component list for on_resize forwarding
    - Draw order: After line 444 (race_controls_comp.draw), before line 447 (draw_overlays)
    - Update hook: Line 449-456 in on_update() - add prediction calculation trigger
    - Key handler: Line 458-494 in on_key_press() - add 'P' key for prediction toggle
    - Mouse delegation: Lines 496-509 - forward to prediction panel

### Environment Setup

- [x] SETUP-01: Add new dependencies to requirements.txt (11657a6)
  - **File**: `D:\RalphTemplate\RalpFI\requirements.txt`
  - **Current contents**: fastf1, pandas, matplotlib, numpy, arcade, pyglet, pyside6, questionary, rich
  - **Add**: `scikit-learn` and `scipy` on new lines

- [x] SETUP-02: Create src/predictions/ directory structure (979c40f)
  - **Action**: Create directory `D:\RalphTemplate\RalpFI\src\predictions\`
  - **Files to create**:
    - `__init__.py` - Exports: PredictionEngine, PredictionPanelComponent, DriverPrediction, PaceModel
    - `models.py` - Data classes for predictions
    - `engine.py` - Core prediction algorithms
    - `ui.py` - UI components following BaseComponent pattern

---

## Phase 1: Core Data Models

- [x] MODEL-01: Create PaceModel dataclass (979c40f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\models.py`
  - **Implementation**:
    ```python
    @dataclass
    class PaceModel:
        driver_code: str
        current_pace: float      # seconds per lap (latest lap)
        rolling_pace: float      # average over last N laps
        tyre_deg_rate: float     # seconds lost per lap due to tyre wear
        fuel_corrected_pace: float  # pace adjusted for fuel load
        gap_trend: float         # positive = gaining on car ahead
    ```

- [x] MODEL-02: Create DriverPrediction dataclass (979c40f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\models.py`
  - **Implementation**:
    ```python
    @dataclass
    class DriverPrediction:
        driver_code: str
        win_probability: float      # 0.0 to 1.0
        podium_probability: float   # 0.0 to 1.0
        predicted_finish: int       # 1-20
        pit_window_start: Optional[int]  # lap number
        pit_window_end: Optional[int]
        should_pit_now: bool
        danger_level: float         # 0.0 (safe) to 1.0 (under attack)
        threat_driver: Optional[str]  # code of attacking driver
        confidence: float           # 0.0 to 1.0
    ```

- [x] MODEL-03: Create TyreState dataclass (979c40f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\models.py`
  - **Implementation**:
    ```python
    @dataclass
    class TyreState:
        compound: int            # 0=SOFT, 1=MEDIUM, 2=HARD, 3=INTER, 4=WET
        laps_on_tyre: int
        deg_rate: float          # seconds per lap
        estimated_cliff_lap: int # when tyre falls off cliff
        remaining_optimal_laps: int
    ```
    - Use `src/lib/tyres.py` mapping: `get_tyre_compound_str(int)` / `get_tyre_compound_int(str)`

- [x] MODEL-04: Create PredictionConfig dataclass (979c40f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\models.py`
  - **Implementation**:
    ```python
    @dataclass
    class PredictionConfig:
        pace_window_laps: int = 5        # laps for rolling average
        update_interval_frames: int = 25  # every 1 second at 25 FPS
        pit_window_buffer_laps: int = 3   # buffer around optimal
        danger_threshold_seconds: float = 1.5  # gap to flag danger
        overtake_probability_threshold: float = 0.3
    ```

---

## Phase 2: Pace Calculation Engine

- [x] PACE-01: Implement lap time extraction from frame data (3339a27)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Function**: `extract_lap_times(frames: List[dict], driver_code: str, up_to_frame: int) -> List[dict]`
  - **Logic**:
    - Iterate frames, detect when `frame['drivers'][code]['lap']` increments
    - Record lap time = timestamp difference between lap start/end
    - Track tyre compound at lap completion
  - **Returns**: `[{"lap": int, "time": float, "tyre": int, "tyre_age": int}, ...]`
  - **Edge cases**: Handle DNF (driver disappears), safety car laps (flag as invalid)

- [x] PACE-02: Implement rolling pace calculation (ef59ca4)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Function**: `calculate_rolling_pace(lap_times: List[dict], window: int = 5) -> float`
  - **Logic**:
    - Take last N valid lap times (exclude pit laps > 120% of median)
    - Return mean of valid laps
  - **Edge cases**: < N laps completed, all laps invalid

- [x] PACE-03: Implement tyre degradation estimation (4a9ec5f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Function**: `estimate_tyre_degradation(lap_times: List[dict]) -> TyreState`
  - **Logic**:
    - Filter lap times on current tyre stint
    - Linear regression: `lap_time = base + deg_rate * tyre_age`
    - Estimate cliff lap based on compound: SOFT ~18, MEDIUM ~30, HARD ~40
  - **Uses**: `scipy.stats.linregress` or simple numpy polyfit

- [x] PACE-04: Implement fuel-corrected pace (9a39d7d)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Function**: `fuel_correct_pace(lap_time: float, lap_number: int, total_laps: int) -> float`
  - **Logic**: `corrected = lap_time - (0.03 * (total_laps - lap_number))`
  - **Note**: ~0.03s/lap is standard F1 fuel correction factor

---

## Phase 3: Win Probability Calculator

- [x] WIN-01: Implement position-based probability baseline (979c40f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `calculate_base_probability(position, total_drivers)` function
    - Use historical win probability by position (P1 ~40%, P2 ~25%, P3 ~15%, etc.)
    - Decay probability exponentially for positions > 3

- [x] WIN-02: Implement gap-based probability adjustment (f8fb1fe)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `adjust_probability_for_gap(base_prob, gap_to_leader, laps_remaining)` function
    - Calculate catchability: gap / (pace_delta * laps_remaining)
    - Reduce probability based on uncatchable gap threshold

- [x] WIN-03: Implement tyre advantage adjustment (f8fb1fe)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `adjust_probability_for_tyres(prob, my_tyre_age, leader_tyre_age, my_compound, leader_compound)` function
    - Fresh tyres vs worn tyres = positive adjustment
    - Calculate expected pace delta based on tyre state

- [x] WIN-04: Implement combined win probability calculator (3d8c1c9)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `calculate_win_probability(frame_data, driver_code, laps_remaining, pace_models)` function
    - Combine base, gap, and tyre adjustments
    - Normalize probabilities across all drivers (sum = 1.0)

---

## Phase 4: Pit Window Predictor

- [x] PIT-01: Implement optimal pit window calculation (ab89bdb)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `calculate_pit_window(tyre_deg_model, laps_remaining, track_position)` function
    - Estimate optimal window: when tyre deg rate crosses threshold
    - Account for undercut/overcut opportunities based on gaps

- [x] PIT-02: Implement pit recommendation logic (ab89bdb)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `get_pit_recommendation(driver_state, pit_window, gap_behind)` function
    - Return "PIT NOW" if: within window AND (losing time OR undercut threat)
    - Return "STAY OUT" with reason if outside window

- [x] PIT-03: Implement strategic pit option comparison (835cbcb)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `compare_pit_strategies(current_state, laps_remaining)` function
    - Model outcomes for: pit now, pit in N laps, no stop
    - Return ranked strategies with predicted finish positions

---

## Phase 5: Position Change Predictor

- [x] POS-01: Implement pace delta calculation (835cbcb)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `calculate_pace_delta(driver1_pace, driver2_pace)` function
    - Return seconds per lap difference
    - Flag as "catching" or "pulling away"

- [x] POS-02: Implement overtake probability (835cbcb)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `calculate_overtake_probability(gap, pace_delta, drs_available)` function
    - DRS zones give +30% overtake probability
    - Return probability of overtake in next N laps

- [x] POS-03: Implement danger zone detection (835cbcb)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\engine.py`
  - **Implementation**:
    - Create `detect_danger_zones(frame_data, driver_code)` function
    - Flag "DANGER" if: car behind within 1.5s AND faster pace
    - Return danger_level (0=safe, 1=warning, 2=danger)

---

## Phase 6: Prediction UI Components

- [x] UI-01: Create PredictionPanelComponent base (979c40f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\ui.py`
  - **Implementation**:
    - Create class extending BaseComponent pattern from ui_components.py
    - Add position properties (x, y, width, height)
    - Add visibility toggle matching existing pattern
    - Define COLORS dict matching existing UI style

- [x] UI-02: Implement win probability bars (979c40f)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\ui.py`
  - **Implementation**:
    - Create `draw_win_probability(predictions, top_n=5)` method
    - Draw horizontal bar chart for top N drivers
    - Color bars by team color from driver_colors
    - Show percentage labels

- [x] UI-03: Implement pit window indicator (84716e9)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\ui.py`
  - **Implementation**:
    - Create `draw_pit_window(pit_state, selected_driver)` method
    - Show visual pit window timeline
    - Highlight "PIT NOW" in flashing color when recommended
    - Show laps until pit window opens/closes

- [x] UI-04: Implement danger zone warnings (84716e9)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\ui.py`
  - **Implementation**:
    - Create `draw_danger_alert(danger_states)` method
    - Show warning icons next to drivers under threat
    - Flash animation for high danger level
    - Show attacker code and gap

- [x] UI-05: Implement confidence indicator (84716e9)
  - **File**: `D:\RalphTemplate\RalpFI\src\predictions\ui.py`
  - **Implementation**:
    - Create `draw_confidence_indicator(confidence_level)` method
    - Show "Confidence: High/Medium/Low" based on data quality
    - Fade out predictions when confidence is low

---

## Phase 7: Integration with Race Replay

- [x] INT-01: Import prediction components into race_replay.py (be6588e)
  - **File**: `D:\RalphTemplate\RalpFI\src\interfaces\race_replay.py`
  - **Changes** (at top of file, after existing imports):
    ```python
    from src.predictions.ui import PredictionPanelComponent
    from src.predictions.engine import PredictionEngine
    ```

- [x] INT-02: Initialize prediction engine in F1RaceReplayWindow.__init__ (be6588e)
  - **File**: `D:\RalphTemplate\RalpFI\src\interfaces\race_replay.py`
  - **Location**: After line 71 (after `self.race_controls_comp` initialization)
  - **Add**:
    ```python
    # Prediction system
    self.prediction_engine = PredictionEngine(config=PredictionConfig())
    self.prediction_panel = PredictionPanelComponent(
        x=self.left_ui_margin + 20,
        width=280,
        visible=False  # Toggle with 'P' key
    )
    self._prediction_update_counter = 0
    self._cached_predictions = {}
    ```

- [x] INT-03: Register prediction panel in on_resize (be6588e)
  - **File**: `D:\RalphTemplate\RalpFI\src\interfaces\race_replay.py`
  - **Location**: Line 231 (in `for c in (...)` list)
  - **Add**: `self.prediction_panel` to the component list

- [x] INT-04: Add prediction update logic to on_update (be6588e)
  - **File**: `D:\RalphTemplate\RalpFI\src\interfaces\race_replay.py`
  - **Location**: After line 456 in `on_update()`
  - **Add**:
    ```python
    # Update predictions every 25 frames (1 second of race time)
    self._prediction_update_counter += 1
    if self._prediction_update_counter >= 25:
        self._prediction_update_counter = 0
        frame = self.frames[int(self.frame_index)]
        laps_remaining = (self.total_laps or 0) - frame.get("lap", 1)
        self._cached_predictions = self.prediction_engine.calculate_all(
            self.frames, int(self.frame_index), laps_remaining
        )
        self.prediction_panel.set_predictions(self._cached_predictions)
    ```

- [x] INT-05: Add prediction panel to draw order (be6588e)
  - **File**: `D:\RalphTemplate\RalpFI\src\interfaces\race_replay.py`
  - **Location**: After line 444 (after `self.race_controls_comp.draw(self)`)
  - **Add**: `self.prediction_panel.draw(self)`

- [x] INT-06: Add keyboard toggle for predictions (be6588e)
  - **File**: `D:\RalphTemplate\RalpFI\src\interfaces\race_replay.py`
  - **Location**: In `on_key_press()`, after line 494 (after 'B' key handler)
  - **Add**:
    ```python
    elif symbol == arcade.key.P:
        self.prediction_panel.toggle_visibility()
    ```

- [x] INT-07: Update legend with new keyboard shortcut (086dcad)
  - **File**: `D:\RalphTemplate\RalpFI\src\ui_components.py`
  - **Location**: In `LegendComponent.__init__`, line 38-46 (self.lines list)
  - **Add**: `("[P]       Toggle Predictions"),` to the legend lines

---

## Phase 8: Testing & Polish

- [x] TEST-01: Create test script for prediction engine (a63ced3)
  - **File**: `D:\f1-race-replay\test_predictions.py`
  - **Tests**:
    - Load a cached race telemetry pickle file
    - Run `extract_lap_times()` and verify output structure
    - Run `calculate_rolling_pace()` with various window sizes
    - Run `estimate_tyre_degradation()` and verify reasonable deg rates
    - Measure execution time (must be < 100ms)

- [x] TEST-02: Test probability calculations (c0253cc)
  - **File**: `D:\f1-race-replay\test_predictions.py`
  - **Tests**:
    - Verify `calculate_all_win_probabilities()` sums to 1.0
    - Verify leader always has highest probability
    - Verify probabilities adjust correctly with gap changes

- [ ] TEST-03: Manual visual testing with real race data
  - **Action**: Run `python main.py --year 2024 --round 1` with prediction panel
  - **Verify**:
    - Press 'P' to toggle prediction panel
    - Win probabilities update as race progresses
    - Pit window recommendations appear
    - Danger zone alerts show for close battles
    - No visible lag or stuttering

---

## Blockers

### TEST-03: Manual Visual Testing Required
**Status**: Requires user action
**Reason**: TEST-03 is an interactive visual test that requires:
1. Running the application: `python main.py --year 2024 --round 1`
2. Pressing 'P' key to toggle prediction panel
3. Visual verification of win probabilities, pit windows, and danger alerts
4. Performance verification (no lag or stuttering)

**Action Required**: User must run the visual test manually and confirm:
- [ ] Press 'P' toggles prediction panel visibility
- [ ] Win probabilities display and update as race progresses
- [ ] Pit window recommendations appear for selected driver
- [ ] Danger zone alerts show for close battles
- [ ] No visible lag or stuttering during playback

Once verified, mark TEST-03 as complete in the implementation plan.

---

## Completed Tasks Log

| Task | Commit | Date |
|------|--------|------|
| DISC-01 | fe8f156 | 2026-01-26 |
| DISC-02 | 036e3fb | 2026-01-26 |
| DISC-03 | 3f3a321 | 2026-01-26 |
| SETUP-01 | 11657a6 | 2026-01-26 |
| SETUP-02 | 979c40f | 2026-01-26 |
| MODEL-01 | 979c40f | 2026-01-26 |
| MODEL-02 | 979c40f | 2026-01-26 |
| MODEL-03 | 979c40f | 2026-01-26 |
| MODEL-04 | 979c40f | 2026-01-26 |
| PACE-01 | 3339a27 | 2026-01-26 |
| PACE-02 | ef59ca4 | 2026-01-26 |
| PACE-03 | 4a9ec5f | 2026-01-26 |
| PACE-04 | 9a39d7d | 2026-01-26 |
| WIN-01 | 979c40f | 2026-01-26 |
| WIN-02 | f8fb1fe | 2026-01-26 |
| WIN-03 | f8fb1fe | 2026-01-26 |
| WIN-04 | 3d8c1c9 | 2026-01-26 |
| PIT-01 | ab89bdb | 2026-01-26 |
| PIT-02 | ab89bdb | 2026-01-26 |
| PIT-03 | 835cbcb | 2026-01-26 |
| POS-01 | 835cbcb | 2026-01-26 |
| POS-02 | 835cbcb | 2026-01-26 |
| POS-03 | 835cbcb | 2026-01-26 |
| UI-01 | 979c40f | 2026-01-26 |
| UI-02 | 979c40f | 2026-01-26 |
| UI-03 | 84716e9 | 2026-01-26 |
| UI-04 | 84716e9 | 2026-01-26 |
| UI-05 | 84716e9 | 2026-01-26 |
| INT-01 | be6588e | 2026-01-26 |
| INT-02 | be6588e | 2026-01-26 |
| INT-03 | be6588e | 2026-01-26 |
| INT-04 | be6588e | 2026-01-26 |
| INT-05 | be6588e | 2026-01-26 |
| INT-06 | be6588e | 2026-01-26 |
| INT-07 | 086dcad | 2026-01-26 |
| TEST-01 | a63ced3 | 2026-01-26 |
| TEST-02 | c0253cc | 2026-01-26 |

---

## Architecture Notes

### Integration Points Summary

1. **Entry Point**: `main.py` calls `run_arcade_replay()` which creates `F1RaceReplayWindow`
2. **Frame Data**: Available via `self.frames[idx]` containing all driver telemetry
3. **UI Component Pattern**: Extend `BaseComponent` with `on_resize()`, `draw()`, `on_mouse_press()`
4. **Component Registration**: Add to window in `__init__`, call draw in `on_draw()`, forward mouse events

### Performance Constraints

- Predictions must calculate in < 100ms
- Use frame sampling (every 25 frames = 1s) to reduce calculation frequency
- Cache predictions between frames
- Use numpy for vectorized operations where possible

### Existing Patterns to Follow

1. **Color Constants**: Use dict pattern like `COLORS = {"key": (r, g, b, a)}`
2. **Visibility Toggle**: `@property visible`, `toggle_visibility()`, `set_visible()`
3. **Text Rendering**: Create `arcade.Text()` objects, call `.draw()`
4. **Hit Testing**: Return `True` from `on_mouse_press()` if event consumed

### Data Flow

```
main.py
  |-- run_arcade_replay()
        |-- F1RaceReplayWindow.__init__()
              |-- Load frames from get_race_telemetry()
              |-- Initialize UI components
              |-- Initialize PredictionEngine (NEW)

on_update() [called 60 FPS]
  |-- Every 25 frames:
        |-- PredictionEngine.update(current_frame, total_laps)
              |-- Extract pace data
              |-- Calculate win probabilities
              |-- Detect danger zones
              |-- Return PredictionState for each driver

on_draw() [called 60 FPS]
  |-- PredictionPanelComponent.draw()
        |-- Draw win probability bars
        |-- Draw pit window (if driver selected)
        |-- Draw danger alerts
```

### Key Files to Modify (Summary)

| File | Type of Change |
|------|---------------|
| `requirements.txt` | Add scikit-learn, scipy |
| `src/predictions/__init__.py` | New file (exports) |
| `src/predictions/models.py` | New file (dataclasses) |
| `src/predictions/engine.py` | New file (prediction logic) |
| `src/predictions/ui.py` | New file (UI components) |
| `src/interfaces/race_replay.py` | Modify (integration) |
| `src/ui_components.py` | Minor modify (add legend entry) |
| `test_predictions.py` | New file (tests) |

### Frame Data Reference

```python
# From f1_data.py:375-388, each frame contains:
frame = {
    "t": 1234.567,           # Seconds from race start
    "lap": 15,               # Leader's current lap
    "drivers": {
        "VER": {
            "x": 1234.5, "y": 5678.9,    # World coordinates
            "dist": 67890.0,              # Race distance (metres from start)
            "lap": 15,                    # This driver's lap
            "rel_dist": 0.45,             # 0-1 progress through current lap
            "tyre": 1.0,                  # 0=SOFT, 1=MED, 2=HARD, 3=INTER, 4=WET
            "position": 1,                # Current race position
            "speed": 312.5,               # km/h
            "gear": 8,
            "drs": 12,                    # >=10 means DRS active
            "throttle": 100.0,            # Percentage
            "brake": 0.0                  # Percentage
        },
        "HAM": {...},
        # ... up to 20 drivers
    },
    "weather": {                          # Optional, may not be present
        "track_temp": 45.2,
        "air_temp": 28.1,
        "humidity": 55.0,
        "wind_speed": 12.5,
        "wind_direction": 180.0,
        "rain_state": "DRY"               # or "RAINING"
    }
}
```

### Compound Life Estimates (for pit window calculations)

| Compound | Base Life (laps) | Cliff Threshold |
|----------|------------------|-----------------|
| SOFT (0) | 15-20 | ~18 laps |
| MEDIUM (1) | 25-35 | ~30 laps |
| HARD (2) | 35-45 | ~40 laps |
| INTERMEDIATE (3) | 20-30 | N/A (weather dependent) |
| WET (4) | 30-40 | N/A (weather dependent) |

### Track Status Codes

| Code | Meaning | Prediction Impact |
|------|---------|-------------------|
| "1" | Green flag | Normal racing |
| "2" | Yellow flag | Slower pace, no overtakes |
| "4" | Safety car | Field compressed, pit opportunity |
| "5" | Red flag | Race stopped |
| "6", "7" | Virtual SC | Slower pace, delta time required |
