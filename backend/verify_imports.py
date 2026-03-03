"""verify_imports.py — Run this to verify all modules import correctly"""
import sys
import os

# Set the working directory to backend/ so imports resolve
os.chdir(os.path.dirname(os.path.abspath(__file__)))

tests = [
    ("types.py", "from app.core.types import *"),
    ("config.py", "from app.config import get_settings"),
    ("models", "from app.models import Job, UploadedDocument, Prerequisite, ScanResult, ValidationReport, Finding, ReviewQueueItem"),
    ("parsers", "from app.extraction.parsers.pdf import PDFParser; from app.extraction.parsers.docx import DocxParser"),
    ("prompts", "from app.extraction.prompts import get_formatted_prompt, build_user_message"),
    ("extraction graph", "from app.extraction.graph import extraction_graph"),
    ("scanner orchestrator", "from app.scanner.orchestrator import ScanOrchestrator"),
    ("validation evaluators", "from app.validation.evaluators import EVALUATOR_MAP"),
    ("validation engine", "from app.validation.engine import ValidationEngine"),
    ("main app", "from app.main import app"),
]

errors = 0
for label, code in tests:
    try:
        exec(code)
        print(f"  OK: {label}")
    except Exception as e:
        print(f"  FAIL [{label}]: {e}", file=sys.stderr)
        errors += 1

print(f"\nResults: {len(tests) - errors}/{len(tests)} passed")
if errors:
    sys.exit(1)
else:
    print("All imports OK!")
