"""app/models/__init__.py — Import all models so Alembic autodiscovers them"""
from app.database import Base  # noqa: F401 — shared metadata base

from app.models.job import Job  # noqa: F401
from app.models.document import UploadedDocument, ParsedDocument  # noqa: F401
from app.models.prerequisite import Prerequisite  # noqa: F401
from app.models.scan_result import ScanResult  # noqa: F401
from app.models.report import ValidationReport, Finding  # noqa: F401
from app.models.review import ReviewQueueItem  # noqa: F401

__all__ = [
    "Base",
    "Job",
    "UploadedDocument",
    "ParsedDocument",
    "Prerequisite",
    "ScanResult",
    "ValidationReport",
    "Finding",
    "ReviewQueueItem",
]
