"""app/main.py — FastAPI application factory"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import documents, jobs, reports, review, scans
from app.database import create_tables

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — create tables on startup."""
    log.info("infra_autopilot_startup")
    await create_tables()
    log.info("database_tables_ready")
    yield
    log.info("infra_autopilot_shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Infra Autopilot",
        description=(
            "Infrastructure prerequisite extraction and validation system.\n\n"
            "## Workflow\n"
            "1. **Upload** a PDF/DOCX prerequisites document → `POST /documents`\n"
            "2. **Poll** extraction job → `GET /jobs/{job_id}`\n"
            "3. **Review** flagged items → `GET /review` + `POST /review/{id}/resolve`\n"
            "4. **Start scan** → `POST /scans`\n"
            "5. **Get report** → `GET /reports/{report_id}`\n"
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(documents.router, prefix="/api/v1", tags=["documents"])
    app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])
    app.include_router(scans.router, prefix="/api/v1", tags=["scans"])
    app.include_router(reports.router, prefix="/api/v1", tags=["reports"])
    app.include_router(review.router, prefix="/api/v1", tags=["review"])

    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "ok", "service": "infra-autopilot"}

    return app


app = create_app()
