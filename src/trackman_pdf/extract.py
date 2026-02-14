"""Extract raw text and tables from Trackman PDF exports.

Primary: pdfplumber (handles table layouts well).
Fallback: pypdf (simpler text extraction).
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class PdfContent:
    """Raw content extracted from a PDF."""
    text: str
    tables: List[List[List[Optional[str]]]]
    page_count: int
    filename: str


def extract_with_pdfplumber(path: str) -> PdfContent:
    """Extract text and tables using pdfplumber."""
    import pdfplumber

    all_text_parts: List[str] = []
    all_tables: List[List[List[Optional[str]]]] = []

    pdf = pdfplumber.open(path)
    page_count = len(pdf.pages)

    for page in pdf.pages:
        text = page.extract_text()
        if text:
            all_text_parts.append(text)
        tables = page.extract_tables()
        if tables:
            all_tables.extend(tables)

    pdf.close()

    import os
    return PdfContent(
        text="\n".join(all_text_parts),
        tables=all_tables,
        page_count=page_count,
        filename=os.path.basename(path),
    )


def extract_with_pypdf(path: str) -> PdfContent:
    """Fallback text extraction using pypdf."""
    from pypdf import PdfReader
    import os

    reader = PdfReader(path)
    all_text_parts: List[str] = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            all_text_parts.append(text)

    return PdfContent(
        text="\n".join(all_text_parts),
        tables=[],
        page_count=len(reader.pages),
        filename=os.path.basename(path),
    )


def extract_pdf(path: str) -> PdfContent:
    """Extract content from a PDF, trying pdfplumber first, then pypdf."""
    try:
        content = extract_with_pdfplumber(path)
        if content.text.strip():
            return content
    except Exception:
        pass

    return extract_with_pypdf(path)
