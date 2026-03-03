"""app/extraction/nodes/extract.py — LLM extraction node using GPT-4.1 via instructor"""
from __future__ import annotations

import structlog
from pydantic import BaseModel

from app.core.types import ExtractedRequirement
from app.extraction.state import ExtractionState

log = structlog.get_logger(__name__)


class ExtractionOutput(BaseModel):
    requirements: list[ExtractedRequirement]


async def extract_node(state: ExtractionState) -> dict:
    """
    Calls GPT-4.1 via instructor to extract requirements.
    On failure, increments extract_attempts.
    Returns empty requirements on repeated failure (not an exception).
    """
    from app.config import get_settings
    from app.extraction.prompts import build_user_message, get_formatted_prompt

    settings = get_settings()

    if not state.get("raw_text") and not state.get("tables"):
        log.warning("extract_node_no_content")
        return {
            "raw_requirements": [],
            "extract_attempts": state.get("extract_attempts", 0),
        }

    try:
        import instructor
        import openai

        client = instructor.from_openai(
            openai.AsyncOpenAI(api_key=settings.openai_api_key)
        )

        result = await client.chat.completions.create(
            model=settings.llm_model,
            max_tokens=settings.llm_max_tokens,
            response_model=ExtractionOutput,
            messages=[
                {"role": "system", "content": get_formatted_prompt()},
                {
                    "role": "user",
                    "content": build_user_message(
                        state.get("raw_text", ""),
                        state.get("tables", []),
                    ),
                },
            ],
            max_retries=2,  # instructor internal retry for schema enforcement
        )

        raw = [r.model_dump() for r in result.requirements]
        log.info("extract_node_complete", count=len(raw))

        return {
            "raw_requirements": raw,
            "extract_attempts": state.get("extract_attempts", 0),
        }

    except Exception as e:
        attempts = state.get("extract_attempts", 0) + 1
        log.error("extract_node_failed", attempt=attempts, error=str(e))
        return {
            "raw_requirements": [],
            "extract_attempts": attempts,
            "errors": state.get("errors", [])
            + [f"extract_failed_attempt_{attempts}: {e}"],
        }
