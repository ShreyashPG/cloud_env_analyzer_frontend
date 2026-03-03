"""app/background/extract_task.py — Background task for the extraction pipeline"""
from __future__ import annotations

import structlog

from app.background.runner import update_job
from app.database import AsyncSessionLocal

log = structlog.get_logger(__name__)


async def run_extraction(document_id: str, job_id: str) -> None:
    """
    Background task for extraction pipeline.
    Creates its own DB session — runs independently of request lifecycle.

    Uses LangGraph's ainvoke() because all nodes are async.
    Progress tracking is done via astream_events so we can update
    job progress as each node completes.

    Progress milestones:
        5%  — document loaded
        10% — parsing started
        35% — parsing done, extraction started
        65% — extraction done, verification started
        80% — verification done, validation started
        90% — validation done, saving results
        100% — complete
    """
    from app.extraction.graph import extraction_graph
    from app.models.document import ParsedDocument, UploadedDocument
    from app.models.prerequisite import Prerequisite as PrerequisiteModel
    from app.models.review import ReviewQueueItem

    async with AsyncSessionLocal() as db:
        try:
            await update_job(db, job_id, "running", 5, "loading_document")

            doc = await db.get(UploadedDocument, document_id)
            if not doc:
                await update_job(
                    db, job_id, "failed", 0, "", error="Document not found"
                )
                return

            await update_job(db, job_id, "running", 10, "parsing_document")

            initial_state = {
                "document_id": document_id,
                "file_bytes": doc.file_bytes,
                "file_type": doc.file_type,
                "raw_text": "",
                "sections": [],
                "tables": [],
                "parser_used": "",
                "parse_errors": [],
                "raw_requirements": [],
                "extract_attempts": 0,
                "requirements_with_flags": [],
                "prerequisites": [],
                "invalid_requirements": [],
                "errors": [],
                "completed": False,
            }

            # ── Stream events from the graph so we can update progress ───────
            # LangGraph's astream_events yields typed events as each node
            # starts and finishes — perfect for granular progress tracking.
            NODE_PROGRESS = {
                "parse": 35,
                "extract": 65,
                "verify": 80,
                "validate": 90,
            }
            NODE_STEP = {
                "parse": "parsing_complete",
                "extract": "extraction_complete",
                "verify": "verification_complete",
                "validate": "validation_complete",
            }

            final_state = None

            try:
                async for event in extraction_graph.astream_events(
                    initial_state, version="v2"
                ):
                    kind = event.get("event", "")
                    name = event.get("name", "")

                    # After each node ends, bump progress
                    if kind == "on_chain_end" and name in NODE_PROGRESS:
                        pct = NODE_PROGRESS[name]
                        step = NODE_STEP[name]
                        log.debug("node_complete_progress", node=name, pct=pct)
                        await update_job(db, job_id, "running", pct, step)

                    # Capture the final output of the root graph run
                    if kind == "on_chain_end" and name == "LangGraph":
                        final_state = event.get("data", {}).get("output")

            except Exception as stream_err:
                # astream_events failed — fall back to plain ainvoke
                log.warning(
                    "astream_events_failed_falling_back_to_ainvoke",
                    error=str(stream_err),
                )
                final_state = await extraction_graph.ainvoke(initial_state)

            if final_state is None:
                # Graph ran but never emitted a final LangGraph event — use ainvoke
                log.warning("final_state_not_captured_falling_back_to_ainvoke")
                final_state = await extraction_graph.ainvoke(initial_state)

            await update_job(db, job_id, "running", 90, "saving_results")

            # ── Save ParsedDocument ──────────────────────────────────────────
            parsed = ParsedDocument(
                document_id=document_id,
                raw_text=final_state.get("raw_text", ""),
                sections=final_state.get("sections", []),
                tables=final_state.get("tables", []),
                parser_used=final_state.get("parser_used", "unknown"),
                parse_errors=final_state.get("parse_errors", []),
            )
            db.add(parsed)

            # ── Save Prerequisites and ReviewQueueItems ──────────────────────
            saved_count = 0
            for prereq_dict in final_state.get("prerequisites", []):
                row = PrerequisiteModel(
                    id=prereq_dict["id"],
                    document_id=document_id,
                    extraction_job_id=job_id,
                    category=prereq_dict["category"],
                    resource_type=prereq_dict["resource_type"],
                    cloud_provider=prereq_dict.get("cloud_provider", "azure"),
                    intent=prereq_dict["intent"],
                    severity=prereq_dict["severity"],
                    conditions=prereq_dict["conditions"],
                    source_text=prereq_dict["source_text"],
                    confidence=prereq_dict["confidence"],
                    review_required=prereq_dict.get("review_required", False),
                    review_reason=prereq_dict.get("review_reason"),
                )
                db.add(row)

                if prereq_dict.get("review_required"):
                    db.add(
                        ReviewQueueItem(
                            prerequisite_id=prereq_dict["id"],
                            reason=prereq_dict.get(
                                "review_reason", "Flagged for review"
                            ),
                        )
                    )

                saved_count += 1

            await db.commit()

            await update_job(
                db,
                job_id,
                "completed",
                100,
                "done",
                result_id=document_id,
            )

            log.info(
                "extraction_complete",
                document_id=document_id,
                prerequisites=saved_count,
                parse_errors=len(final_state.get("parse_errors", [])),
                pipeline_errors=len(final_state.get("errors", [])),
            )

        except Exception as e:
            log.error("extraction_task_failed", document_id=document_id, error=str(e))
            await update_job(db, job_id, "failed", 0, "", error=str(e))
