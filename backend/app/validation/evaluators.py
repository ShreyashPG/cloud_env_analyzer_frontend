"""app/validation/evaluators.py — Pure evaluation functions for every Operator"""
from __future__ import annotations

import re
from typing import Any

import structlog

log = structlog.get_logger(__name__)


def evaluate_gte(actual: Any, expected: Any) -> bool:
    """actual >= expected — tries numeric, then version string comparison."""
    if actual is None:
        return False
    try:
        return float(actual) >= float(expected)
    except (ValueError, TypeError):
        pass
    try:
        from packaging.version import Version

        return Version(str(actual)) >= Version(str(expected))
    except Exception:
        return False


def evaluate_lte(actual: Any, expected: Any) -> bool:
    """actual <= expected — mirrors gte."""
    if actual is None:
        return False
    try:
        return float(actual) <= float(expected)
    except (ValueError, TypeError):
        pass
    try:
        from packaging.version import Version

        return Version(str(actual)) <= Version(str(expected))
    except Exception:
        return False


def evaluate_eq(actual: Any, expected: Any) -> bool:
    """Exact match — booleans compared as bool, strings case-insensitive."""
    if actual is None:
        return False
    if isinstance(actual, bool) or isinstance(expected, bool):
        try:
            return bool(actual) == bool(expected)
        except Exception:
            return False
    return str(actual).strip().lower() == str(expected).strip().lower()


def evaluate_in(actual: Any, expected: Any) -> bool:
    """actual is one of expected list — case-insensitive str comparison."""
    if actual is None:
        return False
    if not isinstance(expected, list):
        expected = [expected]
    actual_lower = str(actual).lower()
    return actual_lower in [str(e).lower() for e in expected]


def evaluate_exists(actual: Any, expected: Any) -> bool:
    """Returns True if actual is not None and not empty string."""
    if actual is None:
        return False
    if isinstance(actual, str) and actual.strip() == "":
        return False
    return True


def evaluate_contains(actual: Any, expected: Any) -> bool:
    """List contains value, or string contains substring."""
    if actual is None:
        return False
    if isinstance(actual, list):
        expected_lower = str(expected).lower()
        return any(str(item).lower() == expected_lower for item in actual)
    return str(expected).lower() in str(actual).lower()


def evaluate_not_eq(actual: Any, expected: Any) -> bool:
    """Must not equal."""
    return not evaluate_eq(actual, expected)


def evaluate_regex(actual: Any, expected: Any) -> bool:
    """Matches regex pattern."""
    if actual is None:
        return False
    try:
        return bool(re.search(str(expected), str(actual)))
    except re.error:
        return False


EVALUATOR_MAP: dict[str, object] = {
    "gte": evaluate_gte,
    "lte": evaluate_lte,
    "eq": evaluate_eq,
    "in": evaluate_in,
    "exists": evaluate_exists,
    "contains": evaluate_contains,
    "not_eq": evaluate_not_eq,
    "regex": evaluate_regex,
}
