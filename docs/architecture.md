# Architecture Notes

This document expands on the README's architecture section with the reasoning
behind specific decisions, for anyone extending the system or asking "why is
it built this way?" in review.

## Layering

```text
Presentation (Streamlit)
        |
        v  HTTP only
API (FastAPI routes) -- thin, no business logic
        |
        v
Services (document/extraction/normalization/matching/scoring/ranking/llm)
        |
        v
Persistence (SQLAlchemy repositories -> SQLite)
```

Each arrow is a hard boundary:

- The frontend never imports backend Python modules - it only calls HTTP
  endpoints. This means the dashboard could be swapped for React (as the
  original assignment allows) without touching the backend at all.
- Routes (`app/api/*.py`) validate the HTTP-level shape of a request, call
  exactly one service method, and shape the response. If you find yourself
  writing an `if`/`for` loop with real logic in a route handler, it belongs
  in a service instead.
- Services never construct SQLAlchemy queries directly - they call
  `app/db/repositories.py`, which is the only place `db.query(...)` appears
  outside of `database.py` itself.

## Why a provider interface for the LLM

`llm_providers/base.py` defines one abstract method: `generate_json(system,
user) -> str`. `gemini_provider.py` and `openrouter_provider.py` each
implement it against their respective SDK/REST API. `llm_service.py` is the
only module that:

- Chooses which provider to instantiate (via `LLM_PROVIDER` in `.env`).
- Loads and fills the prompt templates from `app/prompts/`.
- Parses the provider's raw text response as JSON, retrying on transient
  failures or malformed JSON up to `LLM_MAX_RETRIES`.
- Wraps every provider-specific failure into `LLMProviderError`, so nothing
  downstream needs to know or care which vendor is behind the call.

This means adding a third provider (e.g. Anthropic, a local model) is a
matter of writing one new file that implements `LLMProvider.generate_json`
and a two-line change to `_build_provider()` in `llm_service.py` - nothing
else in the codebase changes.

## Why extraction and matching are validated, not trusted

Every LLM call in this system returns JSON that immediately gets validated
against a Pydantic schema (`CandidateProfile`, `JobProfile`,
`LLMMatchAnalysis`). If the LLM returns something that doesn't fit the
schema - a missing required field, wrong type, extra hallucinated structure -
the request fails loudly with `SchemaValidationError` / `LLMProviderError`
rather than silently coercing bad data into something that looks fine
downstream. This is the same principle as "never invent candidate facts"
applied to the *shape* of the data, not just its content.

## Why matching is reconciled instead of trusting the LLM's skill lists outright

The LLM is genuinely useful for catching skill equivalences the
normalization alias table doesn't know about ("led migration to a
service-oriented architecture" implying microservices experience, for
example). But an ungrounded LLM could also just as easily claim a candidate
has AWS experience when nothing in their resume supports it. `matching_service._reconcile()`
handles this: a job-required or -preferred skill is only marked "matched" if

1. it's found via deterministic skill-set normalization, OR
2. the LLM says it's matched **and** the (normalized) skill text is actually
   present somewhere in the candidate's own skills, evidence, or
   experience/project descriptions.

This is directly unit-tested (see the hallucination-guard test scenario
referenced in the README's matching-algorithm section) - an LLM response that
claims a match with zero supporting evidence in the candidate profile is
overridden back to "missing."

## Why scoring is a separate, pure module

`scoring_service.py` takes already-computed inputs (matched/missing skill
lists, candidate/job profiles, the LLM's relevance/semantic-fit signals) and
returns numbers. It makes zero LLM or DB calls. This is what makes the score
reproducible given the same inputs, and what makes it possible to unit-test
every scoring rule (a missing required skill costs more than a missing
preferred one; experience below the stated minimum is penalized; a
low-relevance experience match is worth less than a high-relevance one) in
isolation, with no mocking required beyond constructing plain Pydantic
objects.

## Two-stage retrieval (not implemented, documented for scale)

At demo scale (a handful to a few dozen resumes per job), running the LLM
matching prompt against every candidate is fine. At real scale (hundreds or
thousands of resumes per job), that becomes expensive and slow. The
documented future path is:

```text
N resumes -> cheap deterministic pre-filter (normalized skill overlap only)
          -> top-K candidates
          -> LLM semantic matching (this repo's matching_service)
          -> final ranked shortlist
```

This isn't built because it's explicitly out of scope for the assignment's
scale, but the separation between `normalization_service` (cheap, no LLM) and
`matching_service` (LLM-backed) already provides the seam where a pre-filter
would slot in without restructuring anything else.
