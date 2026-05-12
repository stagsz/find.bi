import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.ai import router as ai_router
from api.alerts import router as alerts_router
from api.auth import router as auth_router
from api.connections import router as connections_router
from api.dashboards import router as dashboards_router
from api.data import router as data_router
from api.export import router as export_router
from api.narration import router as narration_router
from api.scheduler import router as scheduler_router
from api.voice import router as voice_router
from api.webhooks import router as webhooks_router
from api.workspaces import router as workspaces_router
from services.scheduler_service import start_scheduler

app = FastAPI(title="find.bi", version="0.1.0")

# Allow CORS origins to be configured via environment variable.
# Default to localhost dev origins; in production set CORS_ORIGINS to a
# comma-separated list of allowed origins, e.g.:
#   CORS_ORIGINS=https://bi.example.com,https://bi2.example.com
_cors_env = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    """Start the APScheduler background scheduler on application startup."""
    start_scheduler()


app.include_router(ai_router)
app.include_router(alerts_router)
app.include_router(auth_router)
app.include_router(connections_router)
app.include_router(dashboards_router)
app.include_router(data_router)
app.include_router(export_router)
app.include_router(narration_router)
app.include_router(scheduler_router)
app.include_router(voice_router)
app.include_router(webhooks_router)
app.include_router(workspaces_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "find.bi"}
