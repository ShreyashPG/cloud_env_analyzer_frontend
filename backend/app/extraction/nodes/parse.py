"""app/extraction/nodes/parse.py — Document parsing node"""
from __future__ import annotations

import structlog

from app.extraction.state import ExtractionState

log = structlog.get_logger(__name__)


async def parse_node(state: ExtractionState) -> dict:
    """
    Parses document bytes into text, sections, and tables.
    Returns a partial state update. Never raises.
    """
    try:
        file_type = state.get("file_type", "pdf")

        if file_type == "pdf":
            from app.extraction.parsers.pdf import PDFParser
            result = PDFParser().parse(state["file_bytes"])
        else:
            from app.extraction.parsers.docx import DocxParser
            result = DocxParser().parse(state["file_bytes"])

        log.info(
            "parse_node_complete",
            parser=result["parser_used"],
            text_length=len(result["raw_text"]),
            sections=len(result["sections"]),
            tables=len(result["tables"]),
        )

        return {
            "raw_text": result["raw_text"],
            "sections": result["sections"],
            "tables": result["tables"],
            "parser_used": result["parser_used"],
            "parse_errors": result.get("errors", []),
        }

    except Exception as e:
        log.error("parse_node_failed", error=str(e))
        return {
            "raw_text": "",
            "sections": [],
            "tables": [],
            "parser_used": "failed",
            "parse_errors": [str(e)],
            "errors": state.get("errors", []) + [f"parse_failed: {e}"],
        }
