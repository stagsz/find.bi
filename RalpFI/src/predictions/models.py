"""
Data models for F1 race predictions.

These dataclasses represent the prediction state and configuration
used throughout the prediction engine and UI components.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class PaceModel:
    """Model representing a driver's pace characteristics."""
    driver_code: str
    current_pace: float      # seconds per lap (latest lap)
    rolling_pace: float      # average over last N laps
    tyre_deg_rate: float     # seconds lost per lap due to tyre wear
    fuel_corrected_pace: float  # pace adjusted for fuel load
    gap_trend: float         # positive = gaining on car ahead


@dataclass
class DriverPrediction:
    """Complete prediction state for a single driver."""
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


@dataclass
class TyreState:
    """Current state of a driver's tyres."""
    compound: int            # 0=SOFT, 1=MEDIUM, 2=HARD, 3=INTER, 4=WET
    laps_on_tyre: int
    deg_rate: float          # seconds per lap
    estimated_cliff_lap: int # when tyre falls off cliff
    remaining_optimal_laps: int


@dataclass
class PredictionConfig:
    """Configuration parameters for the prediction engine."""
    pace_window_laps: int = 5        # laps for rolling average
    update_interval_frames: int = 25  # every 1 second at 25 FPS
    pit_window_buffer_laps: int = 3   # buffer around optimal
    danger_threshold_seconds: float = 1.5  # gap to flag danger
    overtake_probability_threshold: float = 0.3
