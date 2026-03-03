"""app/extraction/state.py — ExtractionState TypedDict for LangGraph"""
from __future__ import annotations

from typing import TypedDict


class ExtractionState(TypedDict):
    # Input — set before graph starts
    document_id: str
    file_bytes: bytes
    file_type: str  # "pdf" or "docx"

    # After parse_node
    raw_text: str
    sections: list[dict]
    tables: list[dict]
    parser_used: str
    parse_errors: list[str]

    # After extract_node
    raw_requirements: list[dict]
    extract_attempts: int

    # After verify_node
    requirements_with_flags: list[dict]

    # After validate_node
    prerequisites: list[dict]
    invalid_requirements: list[dict]

    # Error tracking
    errors: list[str]
    completed: bool
