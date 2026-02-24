from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.ai import router as ai_router
from api.auth import router as auth_router
from api.dashboards import router as dashboards_router
from api.data import router as data_router
from api.voice import router as voice_router
from api.workspaces import router as workspaces_router

app = FastAPI(title="find.bi", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(ai_router)
app.include_router(auth_router)
app.include_router(dashboards_router)
app.include_router(data_router)
app.include_router(voice_router)
app.include_router(workspaces_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "find.bi"}
