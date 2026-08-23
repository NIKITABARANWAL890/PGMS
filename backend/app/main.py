"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import auth, pgs, staff, structure

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Phase 1 (Foundation): auth, the PG/building/floor/room/bed hierarchy, "
        "and staff PG assignment. Tenants, billing, complaints, move-outs and "
        "dashboards arrive in Phases 2-6."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(pgs.router)
app.include_router(structure.router)
app.include_router(staff.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok", "phase": "1"}
