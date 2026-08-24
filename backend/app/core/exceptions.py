"""
Application-level exceptions.

Routes and services raise these instead of generic `Exception`s or raw
`HTTPException`s, so that:

  1. Business logic stays framework-agnostic (services don't import FastAPI).
  2. A single exception handler (see `main.py`) can translate every one of
     these into a consistent JSON error response with the right HTTP status
     code, without leaking stack traces or API keys to the client.

Status code mapping (per the project's API error handling spec):

    400  InvalidFileTypeError
    401  InvalidCredentialsError, InvalidTokenError, InactiveUserError
    403  PermissionDeniedError
    404  CandidateNotFoundError, JobNotFoundError, ScreeningNotFoundError,
         UserNotFoundError, CompanyNotFoundError
    409  DuplicateEmailError, LastAdminError
    413  FileTooLargeError
    422  TextExtractionError, SchemaValidationError
    502  LLMProviderError
    500  anything else (unexpected server error)
"""


class ResumeScreenerError(Exception):
    """Base class for all expected/handled application errors."""

    status_code: int = 500
    default_message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None):
        super().__init__(message or self.default_message)
        self.message = message or self.default_message


class InvalidFileTypeError(ResumeScreenerError):
    status_code = 400
    default_message = "Unsupported file type. Only PDF and TXT resumes are accepted."


class FileTooLargeError(ResumeScreenerError):
    status_code = 413
    default_message = "The uploaded file exceeds the maximum allowed size."


class TextExtractionError(ResumeScreenerError):
    status_code = 422
    default_message = "Could not extract usable text from the supplied document."


class OcrRequiredError(TextExtractionError):
    default_message = (
        "This PDF appears to be image-only (scanned). OCR is required but is not "
        "enabled in this deployment."
    )


class SchemaValidationError(ResumeScreenerError):
    status_code = 422
    default_message = "The extracted or provided data did not match the expected schema."


class CandidateNotFoundError(ResumeScreenerError):
    status_code = 404
    default_message = "Candidate not found."


class JobNotFoundError(ResumeScreenerError):
    status_code = 404
    default_message = "Job not found."


class ScreeningNotFoundError(ResumeScreenerError):
    status_code = 404
    default_message = "Screening result not found."


class LLMProviderError(ResumeScreenerError):
    status_code = 502
    default_message = "The LLM provider failed to return a usable response."


# --- Auth / authorization (Phase 7) ---------------------------------------


class InvalidCredentialsError(ResumeScreenerError):
    status_code = 401
    default_message = "Incorrect email or password."


class InvalidTokenError(ResumeScreenerError):
    status_code = 401
    default_message = "The supplied token is missing, invalid, or expired."


class InactiveUserError(ResumeScreenerError):
    status_code = 401
    default_message = "This account has been deactivated."


class PermissionDeniedError(ResumeScreenerError):
    status_code = 403
    default_message = "You do not have permission to perform this action."


class DuplicateEmailError(ResumeScreenerError):
    status_code = 409
    default_message = "An account with this email already exists."


class UserNotFoundError(ResumeScreenerError):
    status_code = 404
    default_message = "User not found."


class CompanyNotFoundError(ResumeScreenerError):
    status_code = 404
    default_message = "Company not found."


class LastAdminError(ResumeScreenerError):
    status_code = 409
    default_message = "Cannot remove or demote the last active admin of a company."
