"""
Low-level PDF/text extraction utilities.

Kept separate from `document_service.py` (which handles validation/policy)
so the extraction functions are trivially unit-testable in isolation.
"""

import re

import fitz  # PyMuPDF

from app.core.exceptions import TextExtractionError


def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    """
    Extract plain text from a PDF's bytes using PyMuPDF.

    Returns an empty/near-empty string (rather than raising) when the PDF has
    no extractable text layer - the caller (`document_service`) decides
    whether that means "OCR required" vs. "genuinely empty document".
    """
    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            pages = [page.get_text("text") for page in doc]
    except Exception as exc:
        raise TextExtractionError(f"Could not open or read the PDF file: {exc}") from exc

    return "\n".join(pages)


def clean_text(raw_text: str) -> str:
    """
    Light, format-preserving cleanup:
      - normalize Windows/Mac line endings
      - collapse 3+ blank lines to 2
      - strip trailing whitespace per line
      - drop non-printable control characters (keep tabs/newlines)
    """
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or ch.isprintable())
    lines = [line.rstrip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
