"""app/extraction/graph.py — LangGraph extraction pipeline builder"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.extraction.nodes.extract import extract_node
from app.extraction.nodes.parse import parse_node
from app.extraction.nodes.validate import validate_node
from app.extraction.nodes.verify import verify_node
from app.extraction.state import ExtractionState


def should_retry_extract(state: ExtractionState) -> str:
    """
    Routing function after extract_node.
    Retry if extraction returned nothing AND we haven't tried twice AND there is text.
    Otherwise proceed to verify.
    """
    if (
        not state.get("raw_requirements")
        and state.get("extract_attempts", 0) < 2
        and state.get("raw_text")
    ):
        return "retry"
    return "verify"


def build_graph():
    """Build and compile the LangGraph extraction pipeline."""
    graph = StateGraph(ExtractionState)

    graph.add_node("parse", parse_node)
    graph.add_node("extract", extract_node)
    graph.add_node("verify", verify_node)
    graph.add_node("validate", validate_node)

    graph.set_entry_point("parse")
    graph.add_edge("parse", "extract")
    graph.add_conditional_edges(
        "extract",
        should_retry_extract,
        {"retry": "extract", "verify": "verify"},
    )
    graph.add_edge("verify", "validate")
    graph.add_edge("validate", END)

    return graph.compile()


# Module-level compiled graph — built once, reused across all requests
extraction_graph = build_graph()
