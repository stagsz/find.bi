"""Alert service: evaluate alerts against DuckDB workspace data."""

from __future__ import annotations

import json
import logging
import os
import smtplib
import urllib.request
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage

import duckdb
from sqlalchemy.orm import Session

from models.alert import Alert

logger = logging.getLogger(__name__)

_CONDITION_OPS = {
    "gt": lambda v, t: v > t,
    "lt": lambda v, t: v < t,
    "eq": lambda v, t: v == t,
    "gte": lambda v, t: v >= t,
    "lte": lambda v, t: v <= t,
}


def evaluate_alert(db_path: str, alert: Alert, db_session: Session) -> dict:
    """Execute *alert.sql_query* against *db_path* and compare to threshold.

    Parameters
    ----------
    db_path:
        Filesystem path to the workspace DuckDB file.
    alert:
        The Alert ORM instance to evaluate.
    db_session:
        Active SQLAlchemy session; used to persist trigger metadata.

    Returns
    -------
    dict with keys:
        triggered (bool), value (float | None), error (str | None).

    Notes
    -----
    - Only SELECT statements are permitted; a ValueError is raised otherwise.
    - The query must return at least one row and the first cell must be numeric.
    """
    sql = alert.sql_query.strip()
    if not sql.upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed in alert sql_query.")

    value: float | None = None
    error: str | None = None
    triggered = False

    try:
        conn = duckdb.connect(db_path, read_only=True)
        try:
            result = conn.execute(sql).fetchone()
        finally:
            conn.close()

        if result is None:
            raise ValueError("Alert query returned no rows.")

        raw = result[0]
        if raw is None:
            raise ValueError("Alert query returned NULL as the first value.")

        try:
            value = float(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Alert query first value is not numeric: {raw!r}"
            ) from exc

        op_fn = _CONDITION_OPS.get(alert.condition)
        if op_fn is None:
            raise ValueError(f"Unknown alert condition: {alert.condition!r}")

        triggered = op_fn(value, alert.threshold)
        if triggered:
            alert.last_triggered_at = datetime.now(tz=timezone.utc)
            alert.last_value = value
            db_session.commit()
            # Deliver notification (non-fatal if it fails)
            try:
                deliver_alert_notification(alert, value)
            except Exception as notify_exc:
                logger.warning("Notification delivery failed for alert %s: %s", alert.id, notify_exc)

    except ValueError:
        raise
    except Exception as exc:
        error = str(exc)
        logger.exception("Error evaluating alert %s: %s", alert.id, exc)
        return {"triggered": False, "value": None, "error": error}

    return {"triggered": triggered, "value": value, "error": None}


def evaluate_all_alerts(
    workspace_id: str, db_path: str, db_session: Session
) -> list[dict]:
    """Evaluate every active alert for *workspace_id*.

    Parameters
    ----------
    workspace_id:
        UUID string of the workspace.
    db_path:
        Path to the workspace DuckDB file.
    db_session:
        Active SQLAlchemy session.

    Returns
    -------
    List of result dicts, each extended with *alert_id* and *alert_name*.
    """
    try:
        ws_uuid = uuid.UUID(workspace_id)
    except ValueError:
        return []

    alerts = (
        db_session.query(Alert)
        .filter(Alert.workspace_id == ws_uuid, Alert.is_active.is_(True))
        .all()
    )

    results = []
    for alert in alerts:
        try:
            res = evaluate_alert(db_path, alert, db_session)
        except ValueError as exc:
            res = {"triggered": False, "value": None, "error": str(exc)}
        res["alert_id"] = str(alert.id)
        res["alert_name"] = alert.name
        results.append(res)

    return results


# ─── Notification Delivery (ALERT-03) ────────────────────────────────────────


def send_browser_notification(alert: Alert, value: float) -> dict:
    """Placeholder for browser push notification delivery.

    Browser push requires a Service Worker + Web Push Protocol on the client
    side. Here we log the intent; a real implementation would use pywebpush
    or a push service (FCM, etc.) with stored subscription endpoints.

    Returns
    -------
    dict with keys: sent (bool), error (str | None).
    """
    logger.info(
        "BROWSER NOTIFY: alert=%r workspace=%s value=%s threshold=%s condition=%s",
        alert.name,
        alert.workspace_id,
        value,
        alert.threshold,
        alert.condition,
    )
    return {"sent": True, "error": None, "channel": "browser"}


def send_email_notification(alert: Alert, value: float) -> dict:
    """Send an alert email via SMTP.

    Reads SMTP configuration from environment variables:
      SMTP_HOST      (default: localhost)
      SMTP_PORT      (default: 587)
      SMTP_USER      (optional)
      SMTP_PASSWORD  (optional)
      SMTP_FROM      (default: alerts@find.bi)

    The alert must have a non-empty `email` field.

    Returns
    -------
    dict with keys: sent (bool), error (str | None).
    """
    to_addr = alert.email
    if not to_addr:
        return {"sent": False, "error": "Alert has no email address.", "channel": "email"}

    smtp_host = os.environ.get("SMTP_HOST", "localhost")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    smtp_from = os.environ.get("SMTP_FROM", "alerts@find.bi")

    subject = f"[find.bi] Alert triggered: {alert.name}"
    body = (
        f"Alert: {alert.name}\n"
        f"Condition: value {alert.condition} {alert.threshold}\n"
        f"Current value: {value}\n"
        f"Triggered at: {datetime.now(tz=timezone.utc).isoformat()}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_addr
    msg.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            if smtp_port == 587:
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        logger.info("Email alert sent to %s for alert %r", to_addr, alert.name)
        return {"sent": True, "error": None, "channel": "email"}
    except Exception as exc:
        logger.warning("Failed to send email alert: %s", exc)
        return {"sent": False, "error": str(exc), "channel": "email"}


def send_webhook_notification(alert: Alert, value: float) -> dict:
    """POST an alert payload to the alert's webhook_url.

    Payload (JSON):
      {alert_id, alert_name, condition, threshold, value, triggered_at}

    Returns
    -------
    dict with keys: sent (bool), status_code (int | None), error (str | None).
    """
    webhook_url = alert.webhook_url
    if not webhook_url:
        return {"sent": False, "status_code": None, "error": "Alert has no webhook URL.", "channel": "webhook"}

    payload = {
        "alert_id": str(alert.id),
        "alert_name": alert.name,
        "condition": alert.condition,
        "threshold": alert.threshold,
        "value": value,
        "triggered_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
        logger.info("Webhook alert sent to %s status=%s for alert %r", webhook_url, status, alert.name)
        return {"sent": True, "status_code": status, "error": None, "channel": "webhook"}
    except Exception as exc:
        logger.warning("Failed to send webhook alert: %s", exc)
        return {"sent": False, "status_code": None, "error": str(exc), "channel": "webhook"}


def deliver_alert_notification(alert: Alert, value: float) -> dict:
    """Route notification to the appropriate delivery channel.

    Dispatches to send_browser_notification, send_email_notification,
    or send_webhook_notification based on alert.channel.

    Returns the delivery result dict from the channel function.
    Raises ValueError for unknown channel.
    """
    if alert.channel == "browser":
        return send_browser_notification(alert, value)
    if alert.channel == "email":
        return send_email_notification(alert, value)
    if alert.channel == "webhook":
        return send_webhook_notification(alert, value)
    raise ValueError(f"Unknown alert channel: {alert.channel!r}")
