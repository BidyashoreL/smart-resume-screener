import fitz
import pytest

from app.core.exceptions import FileTooLargeError, InvalidFileTypeError, OcrRequiredError
from app.services import document_service
from app.services.resume_parser import clean_text, extract_text_from_pdf_bytes


def _make_pdf_bytes(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_extract_text_from_pdf():
    pdf_bytes = _make_pdf_bytes("John Doe\nSoftware Engineer\nSkills: Python, SQL")
    text = extract_text_from_pdf_bytes(pdf_bytes)
    assert "John Doe" in text
    assert "Python" in text


def test_empty_pdf_returns_near_empty_text():
    doc = fitz.open()
    doc.new_page()  # blank page, no text
    pdf_bytes = doc.tobytes()
    doc.close()

    text = extract_text_from_pdf_bytes(pdf_bytes)
    assert text.strip() == ""


def test_invalid_pdf_raises_text_extraction_error():
    from app.core.exceptions import TextExtractionError

    with pytest.raises(TextExtractionError):
        extract_text_from_pdf_bytes(b"this is not a real pdf file")


def test_clean_text_collapses_blank_lines_and_trims_trailing_whitespace():
    raw = "Line one   \n\n\n\nLine two\r\nLine three   "
    cleaned = clean_text(raw)
    assert "\n\n\n" not in cleaned
    assert cleaned.endswith("Line three")
    assert "   \n" not in cleaned


def test_validate_and_extract_rejects_unsupported_extension():
    with pytest.raises(InvalidFileTypeError):
        document_service.validate_and_extract("resume.docx", b"irrelevant content")


def test_validate_and_extract_rejects_oversized_file(monkeypatch):
    from app.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("MAX_FILE_SIZE_MB", "0")  # anything is "too large"
    get_settings.cache_clear()
    try:
        with pytest.raises(FileTooLargeError):
            document_service.validate_and_extract("resume.txt", b"some resume text content")
    finally:
        get_settings.cache_clear()


def test_validate_and_extract_txt_happy_path():
    result = document_service.validate_and_extract("resume.txt", b"Jane Doe\nSkills: Python")
    assert result.raw_text == "Jane Doe\nSkills: Python"
    assert result.extension == ".txt"


def test_validate_and_extract_flags_ocr_required_for_scanned_pdf():
    doc = fitz.open()
    doc.new_page()  # no text layer at all -> looks scanned
    pdf_bytes = doc.tobytes()
    doc.close()

    with pytest.raises(OcrRequiredError):
        document_service.validate_and_extract("scanned_resume.pdf", pdf_bytes)
