"""Scheduler service: APScheduler-based refresh jobs per data source.

Uses APScheduler BackgroundScheduler with a MemoryJobStore.
The scheduler is a module-level singleton; call start_scheduler() from a
FastAPI startup event -- do NOT start it at import time.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    """Return (and lazily create) the module-level BackgroundScheduler singleton."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler()
    return _scheduler


def start_scheduler() -> None:
    """Start the singleton scheduler if it is not already running."""
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("APScheduler started.")


def shutdown_scheduler() -> None:
    """Shut down the singleton scheduler cleanly (wait=False)."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler shut down.")
    _scheduler = None


def parse_cron(cron_expr: str) -> dict:
    """Parse a 5-field cron expression into CronTrigger keyword arguments.

    Parameters
    ----------
    cron_expr:
        Standard 5-field cron string: "minute hour day month day_of_week",
        e.g. "0 9 * * 1-5".

    Returns
    -------
    dict with keys: minute, hour, day, month, day_of_week.

    Raises
    ------
    ValueError
        If *cron_expr* does not have exactly 5 whitespace-separated fields.
    """
    fields = cron_expr.strip().split()
    if len(fields) != 5:
        raise ValueError(
            f"Invalid cron expression '{cron_expr}': "
            f"expected 5 fields (minute hour day month day_of_week), "
            f"got {len(fields)}."
        )
    minute, hour, day, month, day_of_week = fields
    return {
        "minute": minute,
        "hour": hour,
        "day": day,
        "month": month,
        "day_of_week": day_of_week,
    }


def _webhook_refresh_job(workspace_id: str, table_name: str) -> None:
    """Placeholder job that logs a would-refresh message."""
    logger.info(
        "would refresh table %s for workspace %s", table_name, workspace_id,
    )


def add_refresh_job(workspace_id: str, table_name: str, cron_expr: str) -> str:
    """Add a cron-scheduled refresh job for *table_name* in *workspace_id*.

    Parameters
    ----------
    workspace_id:
        UUID string of the workspace.
    table_name:
        Name of the DuckDB table to refresh.
    cron_expr:
        5-field cron string, e.g. "0 9 * * *".

    Returns
    -------
    str
        The APScheduler job ID.

    Raises
    ------
    ValueError
        If *cron_expr* is not a valid 5-field cron expression.
    """
    cron_kwargs = parse_cron(cron_expr)  # raises ValueError on bad input
    trigger = CronTrigger(**cron_kwargs)

    job_id = f"{workspace_id}:{table_name}"
    sched = get_scheduler()
    sched.add_job(
        _webhook_refresh_job,
        trigger=trigger,
        id=job_id,
        name=f"refresh:{workspace_id}:{table_name}",
        args=[workspace_id, table_name],
        replace_existing=True,
    )
    logger.info("Scheduled refresh job %s with cron '%s'.", job_id, cron_expr)
    return job_id


def remove_refresh_job(job_id: str) -> bool:
    """Remove a scheduled job by its ID.

    Returns
    -------
    bool
        True if the job existed and was removed; False if not found.
    """
    sched = get_scheduler()
    job = sched.get_job(job_id)
    if job is None:
        return False
    sched.remove_job(job_id)
    logger.info("Removed refresh job %s.", job_id)
    return True


def list_jobs() -> list[dict]:
    """Return summary info for all scheduled jobs.

    Returns
    -------
    list of dicts, each with keys:
        job_id, name, next_run_time (ISO 8601 string or None).
    """
    sched = get_scheduler()
    result = []
    for job in sched.get_jobs():
        next_run = job.next_run_time
        result.append(
            {
                "job_id": job.id,
                "name": job.name,
                "next_run_time": next_run.isoformat() if next_run else None,
            }
        )
    return result
