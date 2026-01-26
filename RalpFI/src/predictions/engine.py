"""
Prediction engine for F1 race analysis.

Calculates win probabilities, pit windows, and position change predictions
based on telemetry data and pace analysis.
"""

from typing import Dict, List, Optional, Tuple
from src.predictions.models import (
    PaceModel,
    DriverPrediction,
    TyreState,
    PredictionConfig,
)


def extract_lap_times(
    frames: List[dict],
    driver_code: str,
    up_to_frame: int
) -> List[dict]:
    """
    Extract lap times from frame data for a specific driver.

    Iterates through frames and detects lap changes to calculate lap times.
    Handles edge cases like DNFs and safety car periods.

    Args:
        frames: Full list of race frames
        driver_code: Three-letter driver code (e.g., "VER")
        up_to_frame: Only process frames up to this index

    Returns:
        List of lap time records:
        [{"lap": int, "time": float, "tyre": int, "tyre_age": int, "valid": bool}, ...]
    """
    if not frames or up_to_frame <= 0:
        return []

    lap_times: List[dict] = []
    lap_start_time: Optional[float] = None
    lap_start_tyre: Optional[int] = None
    current_lap: Optional[int] = None
    tyre_stint_start_lap: int = 1
    last_tyre: Optional[int] = None

    # Limit processing to specified frame range
    end_frame = min(up_to_frame, len(frames))

    for i in range(end_frame):
        frame = frames[i]
        drivers = frame.get("drivers", {})

        # Driver not in frame (DNF or not started)
        if driver_code not in drivers:
            # If we were tracking a lap, mark it as incomplete
            if lap_start_time is not None:
                lap_times.append({
                    "lap": current_lap,
                    "time": None,
                    "tyre": last_tyre,
                    "tyre_age": (current_lap - tyre_stint_start_lap) if current_lap else 0,
                    "valid": False,
                })
                lap_start_time = None
                current_lap = None
            continue

        driver_data = drivers[driver_code]
        driver_lap = driver_data.get("lap", 1)
        timestamp = frame.get("t", 0.0)
        tyre = int(driver_data.get("tyre", 0))

        # Detect tyre change (pit stop)
        if last_tyre is not None and tyre != last_tyre:
            tyre_stint_start_lap = driver_lap
        last_tyre = tyre

        # First frame for this driver
        if current_lap is None:
            current_lap = driver_lap
            lap_start_time = timestamp
            lap_start_tyre = tyre
            continue

        # Lap change detected
        if driver_lap > current_lap:
            # Calculate lap time
            lap_time = timestamp - lap_start_time if lap_start_time else None

            # Determine if lap is valid (not a pit lap, reasonable time)
            valid = True
            if lap_time is not None:
                # Flag as invalid if likely pit lap (> 30 seconds longer than expected)
                # or if suspiciously fast (< 60 seconds, typical minimum is ~70s)
                if lap_time > 150.0 or lap_time < 60.0:
                    valid = False

            tyre_age = (current_lap - tyre_stint_start_lap)

            lap_times.append({
                "lap": current_lap,
                "time": lap_time,
                "tyre": lap_start_tyre if lap_start_tyre is not None else tyre,
                "tyre_age": tyre_age,
                "valid": valid,
            })

            # Start tracking new lap
            current_lap = driver_lap
            lap_start_time = timestamp
            lap_start_tyre = tyre

    return lap_times


# Tyre cliff estimates by compound (in laps)
TYRE_CLIFF_ESTIMATES = {
    0: 18,   # SOFT
    1: 30,   # MEDIUM
    2: 40,   # HARD
    3: 25,   # INTERMEDIATE (weather dependent)
    4: 35,   # WET (weather dependent)
}


def calculate_rolling_pace(lap_times: List[dict], window: int = 5) -> float:
    """
    Calculate rolling average pace from recent lap times.

    Takes the last N valid lap times (excluding pit laps > 120% of median)
    and returns the mean.

    Args:
        lap_times: List of lap time records from extract_lap_times()
        window: Number of laps to include in rolling average

    Returns:
        Rolling average pace in seconds, or 0.0 if insufficient data
    """
    if not lap_times:
        return 0.0

    # Filter to valid laps with actual times
    valid_laps = [
        lt for lt in lap_times
        if lt.get("valid", False) and lt.get("time") is not None
    ]

    if not valid_laps:
        return 0.0

    # Get lap times as list
    times = [lt["time"] for lt in valid_laps]

    # Calculate median for outlier detection
    sorted_times = sorted(times)
    n = len(sorted_times)
    if n % 2 == 0:
        median = (sorted_times[n // 2 - 1] + sorted_times[n // 2]) / 2
    else:
        median = sorted_times[n // 2]

    # Filter out pit laps (> 120% of median)
    threshold = median * 1.20
    clean_times = [t for t in times if t <= threshold]

    if not clean_times:
        return median  # Fallback to median if all laps filtered

    # Take last N laps
    recent = clean_times[-window:] if len(clean_times) > window else clean_times

    # Return mean
    return sum(recent) / len(recent)


def estimate_tyre_degradation(lap_times: List[dict]) -> TyreState:
    """
    Estimate tyre degradation rate and remaining optimal life.

    Filters lap times to current tyre stint and uses linear regression
    to estimate degradation rate (seconds lost per lap).

    Args:
        lap_times: List of lap time records from extract_lap_times()

    Returns:
        TyreState with degradation analysis
    """
    if not lap_times:
        return TyreState(
            compound=0,
            laps_on_tyre=0,
            deg_rate=0.0,
            estimated_cliff_lap=18,
            remaining_optimal_laps=18,
        )

    # Get the most recent tyre compound
    last_lap = lap_times[-1]
    current_compound = int(last_lap.get("tyre", 0))

    # Filter to current stint (same compound, consecutive)
    stint_laps = []
    for lt in reversed(lap_times):
        if int(lt.get("tyre", 0)) == current_compound and lt.get("valid", False):
            stint_laps.insert(0, lt)
        elif stint_laps:
            break  # Hit previous stint

    laps_on_tyre = len(stint_laps)

    if laps_on_tyre < 2:
        # Not enough data for regression
        cliff_lap = TYRE_CLIFF_ESTIMATES.get(current_compound, 30)
        return TyreState(
            compound=current_compound,
            laps_on_tyre=laps_on_tyre,
            deg_rate=0.0,
            estimated_cliff_lap=cliff_lap,
            remaining_optimal_laps=max(0, cliff_lap - laps_on_tyre),
        )

    # Extract tyre ages and lap times for regression
    ages = [lt.get("tyre_age", 0) for lt in stint_laps if lt.get("time")]
    times = [lt["time"] for lt in stint_laps if lt.get("time")]

    if len(ages) < 2:
        cliff_lap = TYRE_CLIFF_ESTIMATES.get(current_compound, 30)
        return TyreState(
            compound=current_compound,
            laps_on_tyre=laps_on_tyre,
            deg_rate=0.0,
            estimated_cliff_lap=cliff_lap,
            remaining_optimal_laps=max(0, cliff_lap - laps_on_tyre),
        )

    # Simple linear regression: lap_time = base + deg_rate * tyre_age
    # Using numpy-free approach for minimal dependencies
    n = len(ages)
    sum_x = sum(ages)
    sum_y = sum(times)
    sum_xy = sum(a * t for a, t in zip(ages, times))
    sum_xx = sum(a * a for a in ages)

    denominator = n * sum_xx - sum_x * sum_x
    if abs(denominator) < 1e-10:
        deg_rate = 0.0
    else:
        deg_rate = (n * sum_xy - sum_x * sum_y) / denominator

    # Clamp degradation rate to reasonable values (0 to 0.3 s/lap)
    deg_rate = max(0.0, min(0.3, deg_rate))

    # Estimate cliff lap from compound
    base_cliff = TYRE_CLIFF_ESTIMATES.get(current_compound, 30)

    # Adjust cliff estimate based on observed degradation
    # Higher deg rate = earlier cliff
    if deg_rate > 0.1:
        estimated_cliff = int(base_cliff * 0.8)
    elif deg_rate > 0.05:
        estimated_cliff = int(base_cliff * 0.9)
    else:
        estimated_cliff = base_cliff

    remaining_optimal = max(0, estimated_cliff - laps_on_tyre)

    return TyreState(
        compound=current_compound,
        laps_on_tyre=laps_on_tyre,
        deg_rate=deg_rate,
        estimated_cliff_lap=estimated_cliff,
        remaining_optimal_laps=remaining_optimal,
    )


def adjust_probability_for_gap(
    base_prob: float,
    gap_to_leader: float,
    laps_remaining: int,
    pace_delta: float = 0.5
) -> float:
    """
    Adjust win probability based on gap to leader.

    Reduces probability if the gap is uncatchable given remaining laps
    and assumed pace advantage.

    Args:
        base_prob: Base win probability (0.0 to 1.0)
        gap_to_leader: Gap to race leader in seconds
        laps_remaining: Number of laps remaining
        pace_delta: Assumed pace advantage per lap (default 0.5s)

    Returns:
        Adjusted probability
    """
    if base_prob <= 0 or laps_remaining <= 0:
        return base_prob

    # If leading (gap = 0), no adjustment needed
    if gap_to_leader <= 0:
        return base_prob

    # Calculate catchability: can we close the gap with remaining laps?
    # Max gap we can close = pace_delta * laps_remaining
    max_closeable = pace_delta * laps_remaining

    if max_closeable <= 0:
        return base_prob * 0.1  # Severely reduce probability

    # Catchability ratio: 1.0 = can close gap, 0.0 = impossible
    catchability = min(1.0, max_closeable / gap_to_leader)

    # Apply catchability as a scaling factor
    # If catchability < 0.5, significantly reduce probability
    if catchability < 0.5:
        adjustment = catchability * 0.5
    else:
        adjustment = 0.5 + (catchability - 0.5) * 0.5

    return base_prob * adjustment


def adjust_probability_for_tyres(
    prob: float,
    my_tyre_age: int,
    leader_tyre_age: int,
    my_compound: int,
    leader_compound: int
) -> float:
    """
    Adjust win probability based on tyre state relative to leader.

    Fresh tyres vs worn tyres gives a positive adjustment.
    Harder compound vs softer gives endurance advantage.

    Args:
        prob: Current win probability
        my_tyre_age: Laps on current tyre set
        leader_tyre_age: Leader's laps on tyres
        my_compound: Tyre compound (0=SOFT, 1=MED, 2=HARD)
        leader_compound: Leader's tyre compound

    Returns:
        Adjusted probability
    """
    if prob <= 0:
        return prob

    adjustment = 1.0

    # Fresh tyre advantage: newer tyres = better grip
    tyre_age_diff = leader_tyre_age - my_tyre_age
    if tyre_age_diff > 10:
        # Significant advantage if leader is 10+ laps older on tyres
        adjustment *= 1.2
    elif tyre_age_diff > 5:
        adjustment *= 1.1
    elif tyre_age_diff < -10:
        # Disadvantage if my tyres are older
        adjustment *= 0.8
    elif tyre_age_diff < -5:
        adjustment *= 0.9

    # Compound advantage (harder = more endurance, softer = more pace)
    # For late race, harder compounds are advantageous
    compound_diff = my_compound - leader_compound
    if compound_diff > 0:
        # Harder compound - endurance advantage
        adjustment *= 1.05
    elif compound_diff < 0:
        # Softer compound - pace advantage but deg risk
        adjustment *= 0.95

    # Clamp adjustment
    adjusted_prob = prob * adjustment
    return min(1.0, max(0.0, adjusted_prob))


def fuel_correct_pace(lap_time: float, lap_number: int, total_laps: int) -> float:
    """
    Adjust lap time for fuel load to get true pace.

    F1 cars are approximately 0.03 seconds faster per lap as fuel burns off.
    This function normalizes lap times to estimate pace at full fuel load.

    Args:
        lap_time: Raw lap time in seconds
        lap_number: Current lap number
        total_laps: Total laps in the race

    Returns:
        Fuel-corrected lap time in seconds
    """
    if lap_time <= 0 or lap_number <= 0 or total_laps <= 0:
        return lap_time

    # Standard F1 fuel correction factor: ~0.03s per lap of fuel
    FUEL_CORRECTION_PER_LAP = 0.03

    # Calculate fuel remaining (assuming linear burn)
    laps_remaining = max(0, total_laps - lap_number)

    # Adjust lap time: add back the time saved from lighter fuel
    # At lap 1, car is heavy so pace is slow
    # At lap N, car is light so pace appears fast
    # Correction = 0.03 * laps_remaining (more remaining = more weight = slower actual pace)
    corrected = lap_time - (FUEL_CORRECTION_PER_LAP * laps_remaining)

    return corrected


def calculate_pit_window(
    tyre_state: TyreState,
    current_lap: int,
    total_laps: int,
    buffer_laps: int = 3
) -> Tuple[Optional[int], Optional[int]]:
    """
    Calculate the optimal pit window based on tyre degradation.

    The window is centered around when tyre performance is expected
    to significantly degrade (approach the "cliff").

    Args:
        tyre_state: Current tyre state with degradation data
        current_lap: Current lap number
        total_laps: Total laps in the race
        buffer_laps: Buffer around optimal lap for window

    Returns:
        Tuple of (window_start_lap, window_end_lap) or (None, None) if no pit needed
    """
    if total_laps <= 0:
        return (None, None)

    remaining_optimal = tyre_state.remaining_optimal_laps
    cliff_lap = tyre_state.estimated_cliff_lap

    # Calculate optimal pit lap
    # Aim to pit just before the cliff
    optimal_pit_lap = current_lap + remaining_optimal - buffer_laps

    # Don't pit if very early or very late in race
    if optimal_pit_lap <= 5:
        return (None, None)  # Too early to pit
    if optimal_pit_lap >= total_laps - 3:
        return (None, None)  # Too late, just finish the race

    # Create window around optimal
    window_start = max(1, optimal_pit_lap - buffer_laps)
    window_end = min(total_laps - 2, optimal_pit_lap + buffer_laps)

    return (int(window_start), int(window_end))


def get_pit_recommendation(
    current_lap: int,
    pit_window: Tuple[Optional[int], Optional[int]],
    tyre_state: TyreState,
    gap_behind: float,
    is_losing_time: bool = False
) -> Tuple[bool, str]:
    """
    Get pit stop recommendation based on current state.

    Args:
        current_lap: Current lap number
        pit_window: (start_lap, end_lap) tuple
        tyre_state: Current tyre degradation state
        gap_behind: Gap to car behind in seconds
        is_losing_time: Whether driver is losing time on worn tyres

    Returns:
        Tuple of (should_pit_now, reason_string)
    """
    window_start, window_end = pit_window

    # No pit window calculated
    if window_start is None or window_end is None:
        return (False, "No pit window")

    # Before window
    if current_lap < window_start:
        laps_to_window = window_start - current_lap
        return (False, f"Window in {laps_to_window} laps")

    # After window
    if current_lap > window_end:
        return (False, "Past window - stay out")

    # Within window - check conditions for pitting
    in_window = True

    # Urgent: approaching tyre cliff
    if tyre_state.remaining_optimal_laps <= 2:
        return (True, "PIT NOW - Tyre cliff imminent")

    # Urgent: losing significant time
    if is_losing_time and tyre_state.deg_rate > 0.15:
        return (True, "PIT NOW - High degradation")

    # Tactical: undercut threat (car behind very close)
    if gap_behind < 2.0 and current_lap >= window_start:
        return (True, "PIT NOW - Undercut threat")

    # Within window but no urgent reason
    return (False, f"In window (lap {window_start}-{window_end})")


def compare_pit_strategies(
    current_lap: int,
    laps_remaining: int,
    tyre_state: TyreState,
    position: int,
    total_drivers: int
) -> List[dict]:
    """
    Compare different pit strategy options and predict outcomes.

    Models three scenarios: pit now, pit later, no stop.
    Returns ranked strategies by predicted finish position.

    Args:
        current_lap: Current lap number
        laps_remaining: Laps remaining in race
        tyre_state: Current tyre degradation state
        position: Current race position
        total_drivers: Total drivers in race

    Returns:
        List of strategy options sorted by predicted finish position:
        [{"strategy": str, "predicted_finish": int, "confidence": float}, ...]
    """
    strategies = []

    # Strategy 1: Pit now
    # Assume ~20 second pit stop loss, fresh tyres gain back time
    pit_loss_positions = 2  # Typical positions lost in pit
    tyre_gain = min(3, laps_remaining // 10)  # Positions gained from pace
    pit_now_finish = max(1, min(total_drivers, position + pit_loss_positions - tyre_gain))

    strategies.append({
        "strategy": "Pit now",
        "predicted_finish": pit_now_finish,
        "confidence": 0.6 if tyre_state.remaining_optimal_laps < 10 else 0.4,
    })

    # Strategy 2: Pit in 5 laps
    if laps_remaining > 8:
        # Wait to pit - may undercut others
        pit_later_finish = max(1, min(total_drivers, position + pit_loss_positions - tyre_gain - 1))
        strategies.append({
            "strategy": "Pit in 5 laps",
            "predicted_finish": pit_later_finish,
            "confidence": 0.5,
        })

    # Strategy 3: No stop
    # Risk: tyre cliff, but no pit stop time loss
    if laps_remaining < 15:
        deg_penalty = int(tyre_state.deg_rate * laps_remaining / 0.1)  # Positions lost to deg
        no_stop_finish = max(1, min(total_drivers, position + deg_penalty))
        strategies.append({
            "strategy": "No stop",
            "predicted_finish": no_stop_finish,
            "confidence": 0.7 if tyre_state.remaining_optimal_laps > laps_remaining else 0.3,
        })

    # Sort by predicted finish (lower is better)
    strategies.sort(key=lambda s: s["predicted_finish"])

    return strategies


def calculate_pace_delta(driver1_pace: float, driver2_pace: float) -> Tuple[float, str]:
    """
    Calculate pace difference between two drivers.

    Args:
        driver1_pace: Driver 1's pace in seconds per lap
        driver2_pace: Driver 2's pace in seconds per lap

    Returns:
        Tuple of (delta_seconds, direction)
        direction is "catching" if driver1 is faster, "pulling_away" if slower
    """
    if driver1_pace <= 0 or driver2_pace <= 0:
        return (0.0, "stable")

    delta = driver2_pace - driver1_pace

    if abs(delta) < 0.1:
        return (abs(delta), "stable")
    elif delta > 0:
        return (delta, "catching")
    else:
        return (abs(delta), "pulling_away")


def calculate_overtake_probability(
    gap_seconds: float,
    pace_delta: float,
    drs_available: bool,
    laps_to_consider: int = 5
) -> float:
    """
    Calculate probability of overtake in the next N laps.

    Args:
        gap_seconds: Current gap in seconds
        pace_delta: Pace advantage per lap (positive = catching)
        drs_available: Whether DRS is available
        laps_to_consider: Number of laps to project

    Returns:
        Probability of overtake (0.0 to 1.0)
    """
    if gap_seconds <= 0:
        return 0.0  # Already ahead

    if pace_delta <= 0:
        return 0.01  # Not catching, very low probability

    # Time to catch = gap / pace_delta
    laps_to_catch = gap_seconds / pace_delta if pace_delta > 0 else float('inf')

    if laps_to_catch > laps_to_consider:
        base_prob = 0.1  # Unlikely to catch in time
    elif laps_to_catch <= 1:
        base_prob = 0.8  # Very likely to catch
    else:
        # Linear interpolation
        base_prob = 0.8 - (0.7 * (laps_to_catch - 1) / (laps_to_consider - 1))

    # DRS bonus: +30% overtake probability
    if drs_available:
        base_prob = min(0.95, base_prob * 1.3)

    return base_prob


def detect_danger_zones(
    frame_data: dict,
    driver_code: str,
    pace_models: Optional[Dict[str, PaceModel]] = None,
    danger_threshold: float = 1.5
) -> Tuple[float, Optional[str]]:
    """
    Detect if a driver is in danger of being overtaken.

    Args:
        frame_data: Current frame data with all drivers
        driver_code: Driver code to check
        pace_models: Optional pace data for all drivers
        danger_threshold: Gap threshold in seconds for danger

    Returns:
        Tuple of (danger_level, threat_driver_code)
        danger_level: 0.0 = safe, 0.5 = warning, 1.0 = danger
    """
    drivers = frame_data.get("drivers", {})
    driver_data = drivers.get(driver_code)

    if not driver_data:
        return (0.0, None)

    my_position = driver_data.get("position", 20)
    my_dist = driver_data.get("dist", 0)

    # Find car directly behind
    car_behind_code = None
    car_behind_dist = -float('inf')

    for code, data in drivers.items():
        if code == driver_code:
            continue
        pos = data.get("position", 20)
        dist = data.get("dist", 0)

        # Car behind = higher position number, smaller distance
        if pos == my_position + 1:
            car_behind_code = code
            car_behind_dist = dist
            break

    if not car_behind_code:
        return (0.0, None)  # No car behind

    # Calculate gap
    gap_meters = my_dist - car_behind_dist
    gap_seconds = gap_meters / 55.56 if gap_meters > 0 else 0

    # Determine danger level
    if gap_seconds <= danger_threshold * 0.5:
        # Very close - high danger
        return (1.0, car_behind_code)
    elif gap_seconds <= danger_threshold:
        # Within threshold - warning
        return (0.5, car_behind_code)
    elif gap_seconds <= danger_threshold * 2:
        # Approaching - low warning
        return (0.2, car_behind_code)
    else:
        return (0.0, None)  # Safe


class PredictionEngine:
    """
    Core prediction engine that processes race telemetry data
    and generates real-time predictions for all drivers.
    """

    def __init__(self, config: Optional[PredictionConfig] = None):
        """Initialize the prediction engine with configuration."""
        self.config = config or PredictionConfig()
        self._lap_times_cache: Dict[str, List[dict]] = {}
        self._pace_models: Dict[str, PaceModel] = {}

    def calculate_all(
        self,
        frames: List[dict],
        current_frame_idx: int,
        laps_remaining: int
    ) -> Dict[str, DriverPrediction]:
        """
        Calculate predictions for all drivers at the current frame.

        Uses position-based probabilities adjusted for gap, tyres,
        then normalizes so all win probabilities sum to 1.0.

        Args:
            frames: Full list of race frames
            current_frame_idx: Current frame index
            laps_remaining: Number of laps remaining in race

        Returns:
            Dictionary mapping driver codes to their predictions
        """
        if not frames or current_frame_idx < 0:
            return {}

        current_frame = frames[min(current_frame_idx, len(frames) - 1)]
        drivers = current_frame.get("drivers", {})

        if not drivers:
            return {}

        # First pass: calculate raw predictions for each driver
        raw_predictions: Dict[str, DriverPrediction] = {}
        for driver_code in drivers:
            prediction = self._calculate_driver_prediction(
                frames, current_frame_idx, driver_code, laps_remaining
            )
            if prediction:
                raw_predictions[driver_code] = prediction

        # Normalize win probabilities to sum to 1.0
        total_win_prob = sum(p.win_probability for p in raw_predictions.values())
        if total_win_prob > 0:
            for code, pred in raw_predictions.items():
                normalized_win = pred.win_probability / total_win_prob
                # Create new prediction with normalized value
                raw_predictions[code] = DriverPrediction(
                    driver_code=pred.driver_code,
                    win_probability=normalized_win,
                    podium_probability=pred.podium_probability,
                    predicted_finish=pred.predicted_finish,
                    pit_window_start=pred.pit_window_start,
                    pit_window_end=pred.pit_window_end,
                    should_pit_now=pred.should_pit_now,
                    danger_level=pred.danger_level,
                    threat_driver=pred.threat_driver,
                    confidence=pred.confidence,
                )

        return raw_predictions

    def _calculate_driver_prediction(
        self,
        frames: List[dict],
        current_frame_idx: int,
        driver_code: str,
        laps_remaining: int
    ) -> Optional[DriverPrediction]:
        """
        Calculate prediction for a single driver with all adjustments.

        Combines position-based probability with gap and tyre adjustments.
        """
        current_frame = frames[current_frame_idx]
        drivers = current_frame.get("drivers", {})
        driver_data = drivers.get(driver_code)

        if not driver_data:
            return None

        position = driver_data.get("position", 20)
        total_drivers = len(drivers)

        # 1. Calculate base win probability from position
        win_prob = self._calculate_base_probability(position, total_drivers)
        podium_prob = self._calculate_podium_probability(position, total_drivers)

        # 2. Find leader data for gap calculation
        leader_data = None
        leader_code = None
        for code, data in drivers.items():
            if data.get("position") == 1:
                leader_data = data
                leader_code = code
                break

        # 3. Apply gap-based adjustment (if not leading)
        if leader_data and position > 1:
            # Calculate gap using race distance
            my_dist = driver_data.get("dist", 0)
            leader_dist = leader_data.get("dist", 0)
            gap_meters = leader_dist - my_dist

            # Convert to seconds (approx 55.56 m/s at 200 km/h average)
            gap_seconds = gap_meters / 55.56 if gap_meters > 0 else 0

            win_prob = adjust_probability_for_gap(
                win_prob, gap_seconds, laps_remaining
            )

        # 4. Apply tyre advantage adjustment
        if leader_data and leader_code != driver_code:
            my_tyre = int(driver_data.get("tyre", 1))
            leader_tyre = int(leader_data.get("tyre", 1))

            # Estimate tyre age from lap times cache if available
            # For now, use a simple estimate based on current lap
            my_lap = driver_data.get("lap", 1)
            leader_lap = leader_data.get("lap", 1)

            # Rough tyre age estimate (would be better from lap times)
            my_tyre_age = my_lap % 20  # Simple approximation
            leader_tyre_age = leader_lap % 20

            win_prob = adjust_probability_for_tyres(
                win_prob, my_tyre_age, leader_tyre_age,
                my_tyre, leader_tyre
            )

        # Clamp probability
        win_prob = max(0.001, min(0.999, win_prob))

        return DriverPrediction(
            driver_code=driver_code,
            win_probability=win_prob,
            podium_probability=podium_prob,
            predicted_finish=position,
            pit_window_start=None,
            pit_window_end=None,
            should_pit_now=False,
            danger_level=0.0,
            threat_driver=None,
            confidence=0.6,  # Moderate-high confidence with adjustments
        )

    def _calculate_base_probability(self, position: int, total_drivers: int) -> float:
        """Calculate base win probability from current position."""
        if position <= 0 or total_drivers <= 0:
            return 0.0

        # Historical win probability by position
        # P1 ~40%, P2 ~25%, P3 ~15%, exponential decay after
        base_probs = {
            1: 0.40,
            2: 0.25,
            3: 0.15,
            4: 0.08,
            5: 0.05,
        }

        if position in base_probs:
            return base_probs[position]

        # Exponential decay for positions > 5
        if position <= total_drivers:
            return max(0.001, 0.05 * (0.5 ** (position - 5)))

        return 0.0

    def _calculate_podium_probability(self, position: int, total_drivers: int) -> float:
        """Calculate probability of finishing on podium."""
        if position <= 0 or total_drivers <= 0:
            return 0.0

        # Higher probability of maintaining/gaining podium position
        podium_probs = {
            1: 0.95,
            2: 0.85,
            3: 0.70,
            4: 0.40,
            5: 0.25,
            6: 0.15,
            7: 0.08,
            8: 0.04,
        }

        if position in podium_probs:
            return podium_probs[position]

        # Very low probability for positions > 8
        if position <= total_drivers:
            return max(0.001, 0.04 * (0.5 ** (position - 8)))

        return 0.0
