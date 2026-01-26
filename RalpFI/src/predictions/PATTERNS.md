# Patterns & Data Structures - F1 Race Replay

> Reference documentation for prediction feature development.
> Based on analysis of `src/ui_components.py` and `src/f1_data.py`.

## BaseComponent Class (Lines 19-22)

All UI components inherit from `BaseComponent`:

```python
class BaseComponent:
    def on_resize(self, window): pass
    def draw(self, window): pass
    def on_mouse_press(self, window, x: float, y: float, button: int, modifiers: int) -> bool: return False
```

### Method Signatures

| Method | Parameters | Returns | Purpose |
|--------|------------|---------|---------|
| `on_resize` | `window` | None | Called when window resizes |
| `draw` | `window` | None | Render the component |
| `on_mouse_press` | `window, x, y, button, modifiers` | `bool` | Handle click; return `True` if consumed |

## Visibility Pattern

Standard visibility implementation (see `LegendComponent` lines 49-68, `WeatherComponent` lines 134-153):

```python
def __init__(self, ..., visible=True):
    self._visible: bool = visible

@property
def visible(self) -> bool:
    return self._visible

@visible.setter
def visible(self, value: bool):
    self._visible = value

def toggle_visibility(self) -> bool:
    """Toggle visibility and return new state."""
    self._visible = not self._visible
    return self._visible

def set_visible(self):
    """Set visibility to True."""
    self._visible = True

def draw(self, window):
    # ALWAYS check visibility first
    if not self._visible:
        return
    # ... render logic
```

## Color Constants Pattern

Components define colors using a `COLORS` dict (see `RaceProgressBarComponent` lines 726-738):

```python
class MyComponent(BaseComponent):
    COLORS = {
        "background": (30, 30, 30, 200),       # RGBA tuple
        "text": (220, 220, 220),                # RGB tuple
        "highlight": arcade.color.WHITE,        # Arcade constant
        "danger": (220, 50, 50),
    }
```

Common colors used throughout:
- Background panels: `(30, 30, 30, 200)` or `(40, 40, 40, 230)`
- Text: `arcade.color.WHITE`, `arcade.color.LIGHT_GRAY`
- Borders: `(100, 100, 100)`
- Selection highlight: `arcade.color.LIGHT_GRAY`
- Danger/Error: `(220, 50, 50)` or `arcade.color.RED`
- Success/Active: `arcade.color.GREEN`, `(0, 180, 0)`
- Warning: `arcade.color.YELLOW`, `(255, 220, 0)`

## Text Rendering

Create `arcade.Text` objects and call `.draw()`:

```python
# Simple text
arcade.Text(
    "Label",
    x, y,
    arcade.color.WHITE,
    14,  # font size
    bold=True,
    anchor_x="left",   # "left", "center", "right"
    anchor_y="top"     # "top", "center", "bottom"
).draw()

# Reusable text object (more efficient for frequently updated text)
self._text = arcade.Text("", 0, 0, arcade.color.WHITE, 14)
# Later in draw():
self._text.text = "Updated text"
self._text.x = 100
self._text.y = 200
self._text.draw()
```

## Rectangle Drawing

Use `arcade.XYWH` for positioning:

```python
# XYWH = center_x, center_y, width, height
rect = arcade.XYWH(center_x, center_y, width, height)

# Filled rectangle (with optional alpha)
arcade.draw_rect_filled(rect, (40, 40, 40, 200))

# Outlined rectangle
arcade.draw_rect_outline(rect, arcade.color.WHITE, 2)  # 2 = border width
```

## Hit Testing Pattern

Standard mouse press handling (see `LeaderboardComponent` lines 312-334):

```python
def on_mouse_press(self, window, x: float, y: float, button: int, modifiers: int) -> bool:
    # Store clickable areas during draw()
    for code, left, bottom, right, top in self.rects:
        if left <= x <= right and bottom <= y <= top:
            # Handle the click
            window.selected_driver = code
            return True  # Event consumed
    return False  # Event not handled
```

Alternative using rect tuple:
```python
def _point_in_rect(self, x: float, y: float, rect: tuple) -> bool:
    if rect is None:
        return False
    left, bottom, right, top = rect
    return left <= x <= right and bottom <= y <= top
```

## Component Registration in race_replay.py

### Initialization (in `__init__`)

```python
# After line 71 (after self.race_controls_comp)
self.my_component = MyComponent(
    x=self.left_ui_margin + 20,
    width=280,
    visible=False
)
```

### Resize Registration (line 231)

```python
for c in (self.leaderboard, self.weather, self.driver_info,
          self.legend, self.race_progress_bar, self.race_controls_comp,
          self.my_component):  # Add new component here
    c.on_resize(self)
```

### Draw Order (in `on_draw()`)

```python
# After line 444 (after self.race_controls_comp.draw(self))
self.my_component.draw(self)
```

### Mouse Event Forwarding (lines 496-509)

```python
def on_mouse_press(self, x, y, button, modifiers):
    # Check components in reverse draw order (top-most first)
    if self.my_component.on_mouse_press(self, x, y, button, modifiers):
        return
    # ... existing handlers
```

## Keyboard Shortcuts

Add in `on_key_press()` method (lines 458-494):

```python
elif symbol == arcade.key.P:
    self.my_component.toggle_visibility()
```

## Position/Layout Conventions

- `left_ui_margin`: Left panel area (leaderboard, info boxes)
- `right_margin`: Right side clearance (usually 260px for leaderboard)
- Bottom controls: Y position around 30-60px from bottom
- Panel widths: 220-280px typical
- Row heights: 25px for list items
- Font sizes: 18-20 (headers), 14-16 (body), 10-12 (small labels)

## Example: Minimal Component Template

```python
class PredictionPanelComponent(BaseComponent):
    """Prediction overlay panel for race replay."""

    COLORS = {
        "background": (30, 30, 30, 220),
        "border": (100, 100, 100),
        "text": arcade.color.WHITE,
        "text_dim": arcade.color.LIGHT_GRAY,
        "bar_fill": (0, 180, 0),
        "danger": (220, 50, 50),
    }

    def __init__(self, x: int = 20, width: int = 280, visible: bool = False):
        self.x = x
        self.width = width
        self.height = 300
        self._visible = visible
        self._predictions = {}

        # Reusable text object
        self._text = arcade.Text("", 0, 0, arcade.color.WHITE, 14)

    @property
    def visible(self) -> bool:
        return self._visible

    @visible.setter
    def visible(self, value: bool):
        self._visible = value

    def toggle_visibility(self) -> bool:
        self._visible = not self._visible
        return self._visible

    def set_visible(self):
        self._visible = True

    def set_predictions(self, predictions: dict):
        self._predictions = predictions

    def on_resize(self, window):
        # Adjust position based on window size if needed
        pass

    def draw(self, window):
        if not self._visible:
            return

        # Draw panel background
        panel_top = window.height - 50
        center_x = self.x + self.width / 2
        center_y = panel_top - self.height / 2

        rect = arcade.XYWH(center_x, center_y, self.width, self.height)
        arcade.draw_rect_filled(rect, self.COLORS["background"])
        arcade.draw_rect_outline(rect, self.COLORS["border"], 2)

        # Draw header
        self._text.text = "Predictions"
        self._text.x = self.x + 12
        self._text.y = panel_top - 10
        self._text.font_size = 18
        self._text.bold = True
        self._text.color = self.COLORS["text"]
        self._text.draw()

        # Draw prediction content...

    def on_mouse_press(self, window, x: float, y: float, button: int, modifiers: int) -> bool:
        if not self._visible:
            return False

        # Check if click is within panel bounds
        panel_top = window.height - 50
        panel_left = self.x
        panel_right = self.x + self.width
        panel_bottom = panel_top - self.height

        if panel_left <= x <= panel_right and panel_bottom <= y <= panel_top:
            # Handle click within panel
            return True

        return False
```

---

## Data Structures (from f1_data.py)

### Frame Rate Constants (Lines 24-25)

```python
FPS = 25      # Frames per second
DT = 1 / FPS  # Delta time between frames (0.04 seconds)
```

### Frame Structure (Lines 374-412)

Each frame represents a snapshot of all drivers at a specific point in time:

```python
frame = {
    "t": float,           # Timestamp in seconds from race start (e.g., 1234.567)
    "lap": int,           # Leader's current lap number
    "drivers": {
        "VER": {
            "x": float,           # World X coordinate (meters)
            "y": float,           # World Y coordinate (meters)
            "dist": float,        # Total race distance covered (meters)
            "lap": int,           # This driver's current lap number
            "rel_dist": float,    # Relative distance within current lap (0.0 to 1.0)
            "tyre": float,        # Tyre compound as integer:
                                  #   0 = SOFT, 1 = MEDIUM, 2 = HARD
                                  #   3 = INTERMEDIATE, 4 = WET
            "position": int,      # Current race position (1 to 20)
            "speed": float,       # Speed in km/h
            "gear": int,          # Current gear (1-8)
            "drs": int,           # DRS state:
                                  #   0-7 = DRS not available/off
                                  #   8 = DRS available but not active
                                  #   10, 12, 14 = DRS active (wing open)
            "throttle": float,    # Throttle percentage (0-100)
            "brake": float,       # Brake percentage (0-100)
        },
        "HAM": {...},
        # ... up to 20 drivers
    },
    "weather": {                  # Optional - may not be present
        "track_temp": float,      # Track temperature in Celsius
        "air_temp": float,        # Air temperature in Celsius
        "humidity": float,        # Humidity percentage
        "wind_speed": float,      # Wind speed in km/h
        "wind_direction": float,  # Wind direction in degrees
        "rain_state": str,        # "DRY" or "RAINING"
    }
}
```

### Track Status Structure (Lines 270-287)

Track status events indicate flag conditions during the race:

```python
track_status = {
    "status": str,        # Status code (see below)
    "start_time": float,  # Start time in seconds from race start
    "end_time": float,    # End time in seconds (None if ongoing)
}
```

**Status Codes:**
| Code | Meaning | Impact |
|------|---------|--------|
| "1" | Green flag | Normal racing conditions |
| "2" | Yellow flag | Caution, no overtaking in sector |
| "4" | Safety Car | Field bunched up, potential pit opportunity |
| "5" | Red flag | Race stopped |
| "6" | Virtual Safety Car | Strict delta times enforced |
| "7" | VSC Ending | VSC about to end |

### Telemetry Data Return Structure (Lines 432-437)

The `get_race_telemetry()` function returns:

```python
{
    "frames": List[dict],           # List of frame objects (described above)
    "driver_colors": Dict[str, tuple],  # Driver code -> RGB color tuple
    "track_statuses": List[dict],   # List of track status events
    "total_laps": int,              # Total number of laps in the race
}
```

### Tyre Compound Mapping

From `src/lib/tyres.py`:

```python
COMPOUND_MAP = {
    "SOFT": 0,
    "MEDIUM": 1,
    "HARD": 2,
    "INTERMEDIATE": 3,
    "WET": 4,
}

# Typical tyre life estimates (in laps)
# SOFT: 15-20 laps (cliff ~18)
# MEDIUM: 25-35 laps (cliff ~30)
# HARD: 35-45 laps (cliff ~40)
# INTERMEDIATE: 20-30 laps (weather dependent)
# WET: 30-40 laps (weather dependent)
```

### Accessing Frame Data in race_replay.py

```python
# In on_update() or on_draw():
idx = min(int(self.frame_index), self.n_frames - 1)
frame = self.frames[idx]

# Get current race time
current_time = frame["t"]

# Get leader's lap
current_lap = frame["lap"]

# Get specific driver data
driver_data = frame["drivers"].get("VER")
if driver_data:
    position = driver_data["position"]
    speed = driver_data["speed"]
    tyre_compound = driver_data["tyre"]
    lap = driver_data["lap"]

# Get weather (if available)
weather = frame.get("weather")
if weather:
    track_temp = weather["track_temp"]
```

### DRS Detection Logic

```python
def is_drs_active(drs_value: int) -> bool:
    """Check if DRS is currently open."""
    return drs_value in [10, 12, 14]

def is_drs_available(drs_value: int) -> bool:
    """Check if DRS can be activated."""
    return drs_value == 8 or drs_value >= 10
```

### Calculating Gap Between Drivers

```python
# Reference speed for gap calculations (200 km/h = 55.56 m/s)
REFERENCE_SPEED_MS = 55.56

def calculate_gap_seconds(dist1: float, dist2: float) -> float:
    """Calculate time gap between two distances in seconds."""
    distance_diff = abs(dist1 - dist2)
    return distance_diff / REFERENCE_SPEED_MS
```

---

## Integration Points in race_replay.py

> Based on analysis of `src/interfaces/race_replay.py` (510 lines).

### File Structure Overview

```
F1RaceReplayWindow(arcade.Window)
├── __init__() - Lines 22-130
│   ├── Line 51-71: Component initialization
│   └── Line 127-129: Selection state
├── on_resize() - Lines 225-240
│   └── Line 231: Component resize forwarding
├── on_draw() - Lines 269-447
│   └── Lines 434-447: Component draw order
├── on_update() - Lines 449-456
│   └── Line 454-456: Frame advancement
├── on_key_press() - Lines 458-494
│   └── Key handlers (SPACE, arrows, R, D, B)
├── on_mouse_press() - Lines 496-505
│   └── Component mouse forwarding
└── on_mouse_motion() - Lines 507-510
```

### 1. Component Initialization (After Line 71)

Add prediction components after `race_controls_comp`:

```python
# Line 67-71 - existing race_controls_comp
self.race_controls_comp = RaceControlsComponent(
    center_x=self.width // 2,
    center_y=100,
    visible = visible_hud
)

# ADD HERE - Line 72+ (prediction system)
from src.predictions.ui import PredictionPanelComponent
from src.predictions.engine import PredictionEngine
from src.predictions.models import PredictionConfig

self.prediction_engine = PredictionEngine(config=PredictionConfig())
self.prediction_panel = PredictionPanelComponent(
    x=self.left_ui_margin + 20,
    width=280,
    visible=False  # Toggle with 'P' key
)
self._prediction_update_counter = 0
self._cached_predictions = {}
```

### 2. Import Statement (Top of File)

Add after existing imports (line 14):

```python
from src.predictions.ui import PredictionPanelComponent
from src.predictions.engine import PredictionEngine
from src.predictions.models import PredictionConfig
```

### 3. Resize Registration (Line 231)

Add `self.prediction_panel` to the component list:

```python
# Existing line 231:
for c in (self.leaderboard_comp, self.weather_comp, self.legend_comp,
          self.driver_info_comp, self.progress_bar_comp, self.race_controls_comp):
    c.on_resize(self)

# Change to:
for c in (self.leaderboard_comp, self.weather_comp, self.legend_comp,
          self.driver_info_comp, self.progress_bar_comp, self.race_controls_comp,
          self.prediction_panel):  # ADD prediction_panel
    c.on_resize(self)
```

### 4. Update Hook (After Line 456)

Add prediction calculation in `on_update()`:

```python
def on_update(self, delta_time: float):
    # Existing code (lines 449-456):
    self.race_controls_comp.on_update(delta_time)
    if self.paused:
        return
    self.frame_index += delta_time * FPS * self.playback_speed
    if self.frame_index >= self.n_frames:
        self.frame_index = float(self.n_frames - 1)

    # ADD HERE - Prediction update (every 25 frames = 1 second of race time)
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

### 5. Draw Order (After Line 444)

Add prediction panel draw after race controls, before overlays:

```python
# Existing lines 443-447:
self.race_controls_comp.draw(self)

# ADD HERE - Prediction panel (before overlays)
self.prediction_panel.draw(self)

# Draw tooltips and overlays on top of everything
self.progress_bar_comp.draw_overlays(self)
```

### 6. Keyboard Handler (After Line 494)

Add 'P' key for prediction toggle after 'B' key handler:

```python
# Existing line 493-494:
elif symbol == arcade.key.B:
    self.progress_bar_comp.toggle_visibility()

# ADD HERE - Prediction panel toggle
elif symbol == arcade.key.P:
    self.prediction_panel.toggle_visibility()
```

### 7. Mouse Event Forwarding (Lines 496-505)

Add prediction panel to mouse handler chain:

```python
def on_mouse_press(self, x: float, y: float, button: int, modifiers: int):
    # ADD prediction panel check FIRST (if it's a top overlay)
    if self.prediction_panel.on_mouse_press(self, x, y, button, modifiers):
        return

    # Existing handlers (lines 498-505):
    if self.race_controls_comp.on_mouse_press(self, x, y, button, modifiers):
        return
    if self.progress_bar_comp.on_mouse_press(self, x, y, button, modifiers):
        return
    if self.leaderboard_comp.on_mouse_press(self, x, y, button, modifiers):
        return
    self.selected_driver = None
```

### 8. Legend Update (ui_components.py Line 38-46)

Add prediction key to legend:

```python
# In LegendComponent.__init__, self.lines list:
self.lines = [
    ("Controls:"),
    ("[SPACE]  Pause/Resume"),
    ("Rewind / FastForward", ("[", "/", "]"),("arrow-left", "arrow-right")),
    ("Speed +/- (0.5x, 1x, 2x, 4x)", ("[", "/", "]"), ("arrow-up", "arrow-down")),
    ("[R]       Restart"),
    ("[D]       Toggle DRS Zones"),
    ("[B]       Toggle Progress Bar"),
    ("[P]       Toggle Predictions"),  # ADD THIS LINE
]
```

### Window Attributes Available to Components

Components receive `window` parameter and can access:

| Attribute | Type | Description |
|-----------|------|-------------|
| `window.frames` | `List[dict]` | All frame data |
| `window.frame_index` | `float` | Current frame index |
| `window.n_frames` | `int` | Total number of frames |
| `window.total_laps` | `int` | Total race laps |
| `window.paused` | `bool` | Playback paused state |
| `window.playback_speed` | `float` | Current playback speed |
| `window.driver_colors` | `dict` | Driver code -> RGB color |
| `window.selected_driver` | `str` | Currently selected driver code |
| `window.selected_drivers` | `List[str]` | Multiple selected drivers |
| `window.width` | `int` | Window width in pixels |
| `window.height` | `int` | Window height in pixels |
| `window.left_ui_margin` | `int` | Left margin for UI (default 340) |
| `window.right_ui_margin` | `int` | Right margin for UI (default 260) |
| `window.weather_bottom` | `float` | Y position below weather panel |

### Draw Order (Visual Layering)

Components are drawn in this order (bottom to top):
1. Background texture
2. Track lines
3. DRS zones
4. Driver cars (circles)
5. HUD text (lap, time, status)
6. Weather component
7. Leaderboard component
8. Legend component
9. Driver info component
10. Progress bar component
11. Race controls component
12. **Prediction panel (ADD HERE)**
13. Overlays/Tooltips (draw_overlays)
