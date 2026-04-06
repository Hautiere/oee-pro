from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.session import engine
from app.routers import auth, health, referentiel, events, imports

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="OEE Pro API",
    description="API de pilotage de performance machine — Manufacturing 4.0",
    version="0.3.0",
    docs_url="/docs" if settings.is_dev else None,
    redoc_url="/redoc" if settings.is_dev else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router,        prefix="/api/v1")
app.include_router(referentiel.router, prefix="/api/v1")
app.include_router(events.router,      prefix="/api/v1")
app.include_router(imports.router,     prefix="/api/v1")

# Phase 4
# app.include_router(oee.router, prefix="/api/v1")
