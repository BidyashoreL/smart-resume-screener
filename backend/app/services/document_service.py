"""
Document ingestion: validates an uploaded file and extracts raw text from it.

This is the layer described in the project's "Document Ingestion
Architecture" - it never returns silently-empty text to the LLM. If a PDF
looks image-only (near-zero extractable text), it raises `OcrRequiredError`
rather than pretending extraction succeeded.
"""

from dataclasses import dataclass
from pathlib import Path

from app.core.config import get_settings
from app.core.exceptions import FileTooLargeError, InvalidFileTypeError, OcrRequiredError
from app.services.resume_parser import extract_text_from_pdf_bytes, clean_text

# A real resume has more than a trivial number of extractable characters.
# Below this, a "successfully parsed" PDF is almost certainly a scanned image.
MIN_EXTRACTED_CHARS = 40


@dataclass
class ExtractedDocument:
    raw_text: str
    original_filename: str
    extension: str


def validate_and_extract(filename: str, file_bytes: bytes) -> ExtractedDocument:
    """
    Validate an uploaded resume file and extract its text.

    Raises:
        InvalidFileTypeError: unsupported extension.
        FileTooLargeError: exceeds MAX_FILE_SIZE_MB.
        OcrRequiredError: PDF appears to be a scanned image with no OCR available.
        TextExtractionError: file could not be parsed at all.
    """
    settings = get_settings()
    extension = Path(filename).suffix.lower()

    if extension not in settings.allowed_resume_extensions:
        raise InvalidFileTypeError(
            f"'{extension}' is not supported. Allowed types: "
            f"{', '.join(settings.allowed_resume_extensions)}"
        )

    if len(file_bytes) > settings.max_file_size_bytes:
        raise FileTooLargeError(
            f"File is {len(file_bytes) / (1024 * 1024):.1f} MB; "
            f"the limit is {settings.max_file_size_mb} MB."
        )

    if extension == ".pdf":
        raw_text = extract_text_from_pdf_bytes(file_bytes)
        if len(raw_text.strip()) < MIN_EXTRACTED_CHARS:
            raise OcrRequiredError()
    else:  # .txt
        raw_text = file_bytes.decode("utf-8", errors="replace")

    cleaned = clean_text(raw_text)
    return ExtractedDocument(raw_text=cleaned, original_filename=filename, extension=extension)
