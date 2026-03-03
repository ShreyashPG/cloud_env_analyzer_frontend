"""app/extraction/parsers/pdf.py — PDF parsing with docling (primary) and pdfplumber (fallback)"""
from __future__ import annotations

import io
import os
import tempfile

import structlog

log = structlog.get_logger(__name__)


class PDFParser:
    """Parse PDF bytes into structured text, sections, and tables."""

    def parse(self, file_bytes: bytes) -> dict:
        """
        Returns:
            {
                "raw_text": str,
                "sections": list[{"title": str, "text": str}],
                "tables": list[{"title": str, "columns": list, "rows": list[dict]}],
                "parser_used": "docling" | "pdfplumber",
                "errors": list[str]
            }
        Never raises. Always returns a dict.
        """
        try:
            return self._parse_with_docling(file_bytes)
        except Exception as e:
            log.warning("docling_failed_falling_back_to_pdfplumber", error=str(e))
            return self._parse_with_pdfplumber(file_bytes, prior_error=str(e))

    def _parse_with_docling(self, file_bytes: bytes) -> dict:
        from docling.document_converter import DocumentConverter

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            converter = DocumentConverter()
            result = converter.convert(tmp_path)
            doc = result.document

            raw_text = doc.export_to_markdown()

            # Extract tables
            tables = []
            for i, table in enumerate(doc.tables):
                try:
                    data = table.data
                    if not data or len(data) < 2:
                        continue
                    headers = [str(cell.text).strip() for cell in data[0]]
                    rows = []
                    for row in data[1:]:
                        row_dict = {}
                        for j, cell in enumerate(row):
                            key = headers[j] if j < len(headers) else f"col_{j}"
                            row_dict[key] = str(cell.text).strip()
                        rows.append(row_dict)
                    tables.append(
                        {"title": f"Table {i + 1}", "columns": headers, "rows": rows}
                    )
                except Exception as te:
                    log.warning("table_extraction_error", index=i, error=str(te))

            # Extract sections from markdown headings
            sections = _split_markdown_sections(raw_text)

            return {
                "raw_text": raw_text,
                "sections": sections,
                "tables": tables,
                "parser_used": "docling",
                "errors": [],
            }
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    def _parse_with_pdfplumber(
        self, file_bytes: bytes, prior_error: str = ""
    ) -> dict:
        import pdfplumber

        errors = [prior_error] if prior_error else []
        all_text = ""
        all_tables = []

        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    all_text += page_text + "\n"

                    for raw_table in page.extract_tables() or []:
                        if not raw_table or len(raw_table) < 2:
                            continue
                        headers = [str(h).strip() if h else f"col_{i}"
                                   for i, h in enumerate(raw_table[0])]
                        rows = []
                        for row in raw_table[1:]:
                            if not row:
                                continue
                            row_dict = {
                                headers[i]: str(v).strip() if v else ""
                                for i, v in enumerate(row)
                                if i < len(headers)
                            }
                            rows.append(row_dict)
                        all_tables.append(
                            {
                                "title": f"Table {len(all_tables) + 1}",
                                "columns": headers,
                                "rows": rows,
                            }
                        )

            sections = _split_text_sections(all_text)

            return {
                "raw_text": all_text,
                "sections": sections,
                "tables": all_tables,
                "parser_used": "pdfplumber",
                "errors": errors,
            }
        except Exception as e:
            log.error("pdfplumber_failed", error=str(e))
            return {
                "raw_text": "",
                "sections": [],
                "tables": [],
                "parser_used": "pdfplumber",
                "errors": errors + [str(e)],
            }


def _split_markdown_sections(text: str) -> list[dict]:
    """Split markdown text by headings into sections."""
    sections = []
    current_title = "Introduction"
    current_lines: list[str] = []

    for line in text.splitlines():
        if line.startswith("## ") or line.startswith("# "):
            if current_lines:
                sections.append(
                    {
                        "title": current_title,
                        "text": "\n".join(current_lines).strip(),
                    }
                )
            current_title = line.lstrip("#").strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append(
            {"title": current_title, "text": "\n".join(current_lines).strip()}
        )

    return sections


def _split_text_sections(text: str) -> list[dict]:
    """Split plain text into rough sections by double newlines."""
    parts = [p.strip() for p in text.split("\n\n") if p.strip()]
    return [{"title": f"Section {i + 1}", "text": p} for i, p in enumerate(parts)]
