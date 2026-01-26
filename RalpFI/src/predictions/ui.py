"""
UI components for displaying race predictions.

Provides visual overlays for win probability, pit windows,
and danger zone alerts following the BaseComponent pattern.
"""

import arcade
from typing import Dict, Optional
from src.ui_components import BaseComponent
from src.predictions.models import DriverPrediction


class PredictionPanelComponent(BaseComponent):
    """
    Prediction overlay panel for race replay.

    Displays win probability bars, pit window indicators,
    and danger zone warnings for selected drivers.
    """

    COLORS = {
        "background": (30, 30, 30, 220),
        "border": (100, 100, 100),
        "text": arcade.color.WHITE,
        "text_dim": arcade.color.LIGHT_GRAY,
        "bar_bg": (60, 60, 60),
        "bar_fill": (0, 180, 0),
        "danger": (220, 50, 50),
        "warning": (255, 180, 0),
        "safe": (0, 180, 0),
    }

    def __init__(self, x: int = 20, width: int = 280, visible: bool = False):
        """
        Initialize the prediction panel.

        Args:
            x: Left edge X position
            width: Panel width in pixels
            visible: Initial visibility state
        """
        self.x = x
        self.width = width
        self.height = 300
        self._visible = visible
        self._predictions: Dict[str, DriverPrediction] = {}

        # Reusable text object for efficiency
        self._text = arcade.Text("", 0, 0, arcade.color.WHITE, 14)

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

    def set_predictions(self, predictions: Dict[str, DriverPrediction]):
        """Update the predictions to display."""
        self._predictions = predictions or {}

    def on_resize(self, window):
        """Handle window resize."""
        pass

    def draw(self, window):
        """Render the prediction panel."""
        if not self._visible:
            return

        # Calculate panel position
        panel_top = window.height - 50
        center_x = self.x + self.width / 2
        center_y = panel_top - self.height / 2

        # Draw panel background
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
        self._text.anchor_y = "top"
        self._text.draw()

        # Draw win probability section
        self._draw_win_probabilities(window, panel_top - 40)

        # Get selected driver for detailed info
        selected = getattr(window, 'selected_driver', None)

        # Draw pit window (if driver selected)
        y = panel_top - 180
        y = self._draw_pit_window(window, y, selected)

        # Draw danger alert (if driver selected)
        y = self._draw_danger_alert(window, y, selected)

        # Draw confidence indicator at bottom
        self._draw_confidence_indicator(window, panel_top - self.height + 20, selected)

    def _draw_win_probabilities(self, window, start_y: float, top_n: int = 5):
        """Draw horizontal bar chart for top N drivers by win probability."""
        if not self._predictions:
            self._text.text = "No data available"
            self._text.x = self.x + 12
            self._text.y = start_y
            self._text.font_size = 12
            self._text.bold = False
            self._text.color = self.COLORS["text_dim"]
            self._text.draw()
            return

        # Sort drivers by win probability
        sorted_drivers = sorted(
            self._predictions.items(),
            key=lambda x: x[1].win_probability,
            reverse=True
        )[:top_n]

        bar_height = 18
        bar_spacing = 26
        bar_max_width = self.width - 80

        for i, (code, pred) in enumerate(sorted_drivers):
            y = start_y - (i * bar_spacing)

            # Get driver color from window
            driver_color = window.driver_colors.get(code, arcade.color.GRAY)

            # Draw driver code
            self._text.text = code
            self._text.x = self.x + 12
            self._text.y = y
            self._text.font_size = 12
            self._text.bold = True
            self._text.color = driver_color
            self._text.anchor_y = "top"
            self._text.draw()

            # Draw probability bar background
            bar_x = self.x + 50
            bar_center_y = y - bar_height / 2
            bg_rect = arcade.XYWH(
                bar_x + bar_max_width / 2,
                bar_center_y,
                bar_max_width,
                bar_height
            )
            arcade.draw_rect_filled(bg_rect, self.COLORS["bar_bg"])

            # Draw probability bar fill
            prob = pred.win_probability
            fill_width = max(2, bar_max_width * prob)
            fill_rect = arcade.XYWH(
                bar_x + fill_width / 2,
                bar_center_y,
                fill_width,
                bar_height - 2
            )
            arcade.draw_rect_filled(fill_rect, driver_color)

            # Draw percentage label
            pct_str = f"{prob * 100:.1f}%"
            self._text.text = pct_str
            self._text.x = bar_x + bar_max_width + 8
            self._text.y = y
            self._text.font_size = 10
            self._text.bold = False
            self._text.color = self.COLORS["text"]
            self._text.draw()

    def _draw_pit_window(self, window, start_y: float, selected_driver: str = None):
        """
        Draw pit window indicator for selected driver.

        Shows visual timeline of pit window and recommendation.
        """
        if not self._predictions or not selected_driver:
            return start_y

        pred = self._predictions.get(selected_driver)
        if not pred:
            return start_y

        # Section header
        self._text.text = "Pit Window"
        self._text.x = self.x + 12
        self._text.y = start_y
        self._text.font_size = 14
        self._text.bold = True
        self._text.color = self.COLORS["text"]
        self._text.draw()

        y = start_y - 20

        if pred.pit_window_start is None:
            self._text.text = "No pit recommended"
            self._text.x = self.x + 12
            self._text.y = y
            self._text.font_size = 11
            self._text.bold = False
            self._text.color = self.COLORS["text_dim"]
            self._text.draw()
            return y - 25

        # Show pit window range
        window_text = f"Lap {pred.pit_window_start}-{pred.pit_window_end}"
        self._text.text = window_text
        self._text.x = self.x + 12
        self._text.y = y
        self._text.font_size = 11
        self._text.color = self.COLORS["text"]
        self._text.draw()

        y -= 20

        # Show recommendation
        if pred.should_pit_now:
            self._text.text = "PIT NOW"
            self._text.color = self.COLORS["danger"]
            self._text.bold = True
        else:
            self._text.text = "Stay out"
            self._text.color = self.COLORS["safe"]
            self._text.bold = False

        self._text.x = self.x + 12
        self._text.y = y
        self._text.font_size = 12
        self._text.draw()

        return y - 25

    def _draw_danger_alert(self, window, start_y: float, selected_driver: str = None):
        """
        Draw danger zone warning for selected driver.

        Shows threat level and attacking driver info.
        """
        if not self._predictions or not selected_driver:
            return start_y

        pred = self._predictions.get(selected_driver)
        if not pred:
            return start_y

        # Section header
        self._text.text = "Position Threat"
        self._text.x = self.x + 12
        self._text.y = start_y
        self._text.font_size = 14
        self._text.bold = True
        self._text.color = self.COLORS["text"]
        self._text.draw()

        y = start_y - 20

        # Determine threat level
        danger = pred.danger_level
        if danger >= 0.8:
            status = "DANGER"
            color = self.COLORS["danger"]
        elif danger >= 0.4:
            status = "WARNING"
            color = self.COLORS["warning"]
        else:
            status = "SAFE"
            color = self.COLORS["safe"]

        self._text.text = status
        self._text.x = self.x + 12
        self._text.y = y
        self._text.font_size = 12
        self._text.bold = True
        self._text.color = color
        self._text.draw()

        y -= 18

        # Show threat driver if any
        if pred.threat_driver:
            threat_color = window.driver_colors.get(pred.threat_driver, arcade.color.GRAY)
            self._text.text = f"Threat: {pred.threat_driver}"
            self._text.x = self.x + 12
            self._text.y = y
            self._text.font_size = 11
            self._text.bold = False
            self._text.color = threat_color
            self._text.draw()
            y -= 18

        return y - 10

    def _draw_confidence_indicator(self, window, start_y: float, selected_driver: str = None):
        """
        Draw confidence indicator for prediction quality.
        """
        if not self._predictions:
            return start_y

        # Calculate average confidence
        if selected_driver and selected_driver in self._predictions:
            confidence = self._predictions[selected_driver].confidence
        else:
            confidences = [p.confidence for p in self._predictions.values()]
            confidence = sum(confidences) / len(confidences) if confidences else 0.5

        # Determine confidence label
        if confidence >= 0.7:
            label = "High"
            color = self.COLORS["safe"]
        elif confidence >= 0.4:
            label = "Medium"
            color = self.COLORS["warning"]
        else:
            label = "Low"
            color = self.COLORS["danger"]

        self._text.text = f"Confidence: {label}"
        self._text.x = self.x + 12
        self._text.y = start_y
        self._text.font_size = 10
        self._text.bold = False
        self._text.color = color
        self._text.draw()

        return start_y - 15

    def on_mouse_press(
        self, window, x: float, y: float, button: int, modifiers: int
    ) -> bool:
        """Handle mouse click within panel."""
        if not self._visible:
            return False

        # Check if click is within panel bounds
        panel_top = window.height - 50
        panel_left = self.x
        panel_right = self.x + self.width
        panel_bottom = panel_top - self.height

        if panel_left <= x <= panel_right and panel_bottom <= y <= panel_top:
            # Consume the click to prevent it from propagating
            return True

        return False
