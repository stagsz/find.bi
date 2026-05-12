"""Tests for ALERT-03: alert notification delivery functions."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from models.alert import Alert
from services.alert_service import (
    deliver_alert_notification,
    send_browser_notification,
    send_email_notification,
    send_webhook_notification,
)


# ─── Fixtures ──────────────────────────────────────────────────────────────────


def make_alert(
    channel: str = "browser",
    email: str | None = None,
    webhook_url: str | None = None,
) -> Alert:
    alert = Alert()
    alert.id = uuid.uuid4()
    alert.workspace_id = uuid.uuid4()
    alert.name = "Test Alert"
    alert.sql_query = "SELECT COUNT(*) FROM t"
    alert.condition = "gt"
    alert.threshold = 5.0
    alert.channel = channel
    alert.email = email
    alert.webhook_url = webhook_url
    alert.is_active = True
    alert.last_triggered_at = None
    alert.last_value = None
    return alert


# ─── Browser notification ──────────────────────────────────────────────────────


class TestBrowserNotification:
    def test_browser_returns_sent_true(self) -> None:
        alert = make_alert(channel="browser")
        result = send_browser_notification(alert, 10.0)
        assert result["sent"] is True
        assert result["error"] is None
        assert result["channel"] == "browser"

    def test_browser_logs_info(self, caplog: pytest.LogCaptureFixture) -> None:
        import logging

        alert = make_alert(channel="browser")
        with caplog.at_level(logging.INFO, logger="services.alert_service"):
            send_browser_notification(alert, 42.0)
        assert "BROWSER NOTIFY" in caplog.text
        assert alert.name in caplog.text


# ─── Email notification ───────────────────────────────────────────────────────


class TestEmailNotification:
    def test_email_no_address_returns_error(self) -> None:
        alert = make_alert(channel="email", email=None)
        result = send_email_notification(alert, 10.0)
        assert result["sent"] is False
        assert result["error"] is not None
        assert result["channel"] == "email"

    def test_email_sends_message(self) -> None:
        alert = make_alert(channel="email", email="user@example.com")
        with patch("services.alert_service.smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_server)
            mock_smtp.return_value.__exit__ = MagicMock(return_value=False)
            result = send_email_notification(alert, 10.0)
        assert result["sent"] is True
        assert result["error"] is None
        assert result["channel"] == "email"

    def test_email_smtp_failure_returns_error(self) -> None:
        alert = make_alert(channel="email", email="user@example.com")
        with patch("services.alert_service.smtplib.SMTP", side_effect=ConnectionRefusedError("no SMTP")):
            result = send_email_notification(alert, 10.0)
        assert result["sent"] is False
        assert "no SMTP" in str(result["error"])
        assert result["channel"] == "email"


# ─── Webhook notification ─────────────────────────────────────────────────────


class TestWebhookNotification:
    def test_webhook_no_url_returns_error(self) -> None:
        alert = make_alert(channel="webhook", webhook_url=None)
        result = send_webhook_notification(alert, 10.0)
        assert result["sent"] is False
        assert result["error"] is not None
        assert result["channel"] == "webhook"

    def test_webhook_sends_post(self) -> None:
        alert = make_alert(channel="webhook", webhook_url="https://hooks.example.com/notify")
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch("services.alert_service.urllib.request.urlopen", return_value=mock_resp):
            result = send_webhook_notification(alert, 10.0)
        assert result["sent"] is True
        assert result["status_code"] == 200
        assert result["error"] is None
        assert result["channel"] == "webhook"

    def test_webhook_request_failure_returns_error(self) -> None:
        alert = make_alert(channel="webhook", webhook_url="https://hooks.example.com/notify")
        with patch(
            "services.alert_service.urllib.request.urlopen",
            side_effect=Exception("timeout"),
        ):
            result = send_webhook_notification(alert, 10.0)
        assert result["sent"] is False
        assert "timeout" in str(result["error"])
        assert result["channel"] == "webhook"

    def test_webhook_includes_alert_metadata_in_payload(self) -> None:
        """Verify the JSON payload sent contains all required fields."""
        alert = make_alert(channel="webhook", webhook_url="https://hooks.example.com/notify")
        captured: list[bytes] = []

        def capture_urlopen(req: object, timeout: int = 10) -> object:  # noqa: ARG001
            captured.append(getattr(req, "data", b""))
            mock_resp = MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = MagicMock(return_value=False)
            return mock_resp

        with patch("services.alert_service.urllib.request.urlopen", side_effect=capture_urlopen):
            send_webhook_notification(alert, 42.0)

        import json

        payload = json.loads(captured[0])
        assert payload["value"] == 42.0
        assert payload["alert_name"] == "Test Alert"
        assert payload["condition"] == "gt"
        assert "triggered_at" in payload


# ─── deliver_alert_notification dispatcher ────────────────────────────────────


class TestDeliverAlertNotification:
    def test_routes_browser(self) -> None:
        alert = make_alert(channel="browser")
        result = deliver_alert_notification(alert, 5.0)
        assert result["channel"] == "browser"

    def test_routes_email(self) -> None:
        alert = make_alert(channel="email", email=None)
        result = deliver_alert_notification(alert, 5.0)
        assert result["channel"] == "email"

    def test_routes_webhook(self) -> None:
        alert = make_alert(channel="webhook", webhook_url=None)
        result = deliver_alert_notification(alert, 5.0)
        assert result["channel"] == "webhook"

    def test_unknown_channel_raises(self) -> None:
        alert = make_alert(channel="slack")
        with pytest.raises(ValueError, match="Unknown alert channel"):
            deliver_alert_notification(alert, 5.0)
