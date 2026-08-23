# Smart Resume Screener

A structured, evidence-backed recruiter screening system. Given a job description
and a set of resumes, it answers: **which candidates are the strongest matches,
why, and what evidence supports that decision?**

It is deliberately built as a screening *pipeline* — document ingestion, structured
extraction, hybrid deterministic + LLM matching, scoring, and ranking — rather than
as `resume + job description -> LLM -> a number`.

---

## 1. Problem Statement

Recruiters routinely need to compare many resumes against a single job description
and decide who to interview. Doing this manually is slow and inconsistent; doing it
with a single opaque LLM call ("give this resume a score out of 10") is fast but
unreproducible, hard to debug, and impossible to explain to a candidate or a
hiring manager.

## 2. Objective

Build a system that:

- Extracts structured candidate data (skills, experience, education, projects)
  from PDF/TXT resumes without inventing facts.
- Extracts structured requirements (required/preferred skills, experience,
  education, responsibilities) from a job description.
- Matches candidates against a job using a **hybrid** engine: deterministic,
  reproducible skill/education/experience checks, supplemented by LLM semantic
  reasoning for equivalence, relevance, and explanation — never a single
  opaque LLM score.
- Produces a ranked, evidence-backed shortlist with matched/missing skills,
  strengths, weaknesses, and a plain-language justification for every candidate.

## 3. Features

- PDF and TXT resume upload with OCR-required detection (never silently
  screens an empty/scanned document).
- LLM-based structured extraction of candidate and job profiles, validated
  against a strict Pydantic schema before anything downstream trusts it.
- Skill normalization (`ML` → `machine learning`, `Postgres` → `postgresql`, etc.)
  so naive string mismatches don't cause false negatives.
- Hybrid matching: deterministic normalized-skill overlap **plus** LLM semantic
  matching, reconciled with an anti-hallucination guard (an LLM-claimed skill
  match is only trusted if it's actually grounded in the candidate's own
  profile text).
- Deterministic, reproducible, weighted scoring (skills / experience /
  responsibilities / education) — the LLM supplies inputs, never the final
  number.
- Ranking with configurable match bands (Strong / Good / Partial / Low) and a
  SHORTLIST / CONSIDER / REJECT recommendation.
- Persistent storage (SQLite) so a resume's extraction is cached and reused
  across multiple job screenings instead of being re-sent to the LLM.
- REST API (FastAPI, with automatic OpenAPI/Swagger docs at `/docs`).
- Streamlit recruiter dashboard.
- Unit + integration test suite (45 tests) that runs with zero network calls
  (the LLM is mocked at the service boundary).
- Consistent, documented API error handling (400/404/413/422/502/500).

## 4. Architecture

```text
                         +----------------------+
                         |      Recruiter       |
                         +----------+-----------+
                                    |
                      +-------------+-------------+
                      |                           |
                      v                           v
              Job Description               Resume PDFs/TXT
                      |                           |
                      v                           v
              +---------------+          +---------------+
              | JD Extraction |          | PDF/TXT       |
              | Service       |          | Parser        |
              +-------+-------+          +-------+-------+
                      |                          |
                      v                          v
              +---------------+          +---------------+
              | Job Profile   |          | Resume Text   |
              | JSON          |          +-------+-------+
              +-------+-------+                  |
                      |                          v
                      |                  +---------------+
                      |                  | Information   |
                      |                  | Extraction    |
                      |                  +-------+-------+
                      |                          |
                      |                          v
                      |                  +---------------+
                      |                  | Candidate     |
                      |                  | Profile JSON  |
                      |                  +-------+-------+
                      |                          |
                      +-------------+------------+
                                    |
                                    v
                         +----------------------+
                         | Normalization Layer  |
                         | Skills / Experience  |
                         +----------+-----------+
                                    |
                   +----------------+----------------+
                   |                                 |
                   v                                 v
          +-------------------+             +-------------------+
          | Deterministic     |             | LLM Semantic      |
          | Matching          |             | Matching          |
          | Skill overlap     |             | Context/Relevance |
          | Experience        |             | Explanation       |
          +---------+---------+             +---------+---------+
                    |                                 |
                    +----------------+----------------+
                                     |
                                     v
                           +--------------------+
                           | Hybrid Scoring     |
                           | + Evidence         |
                           +---------+----------+
                                     |
                                     v
                           +--------------------+
                           | Ranking Engine     |
                           +---------+----------+
                                     |
                                     v
                           +--------------------+
                           | Shortlist          |
                           | + Justification    |
                           +---------+----------+
                                     |
                         +-----------+-----------+
                         |                       |
                         v                       v
                  +-------------+         +-------------+
                  | FastAPI     |         | SQLite      |
                  | Backend     |         | Database    |
                  +------+------+         +-------------+
                         |
                         v
                  +-------------+
                  | Streamlit   |
                  | Dashboard   |
                  +-------------+
```

### Why built this way

Document processing, structured extraction, deterministic matching, LLM
semantic analysis, scoring, and ranking are separated into independent
services (`backend/app/services/`). The deterministic layer provides
reproducible, job-relevant signals; the LLM is used specifically where
semantic reasoning helps — skill equivalence, experience relevance, and
explanation — never as the sole source of the final score. Candidate
profiles are stored in structured form so the same resume can be evaluated
against multiple jobs without re-processing the document. The API and
database layers are separated from the frontend, which keeps the system
easy to test and extend.

## 5. System Flow

```text
Upload resume(s) --> Extract text --> LLM structured extraction --> validate
    --> store Candidate Profile

Paste job description --> LLM structured extraction --> validate
    --> store Job Profile

Screen: for each candidate x job
    --> normalize skills (deterministic)
    --> LLM semantic match analysis
    --> reconcile (anti-hallucination guard)
    --> deterministic weighted scoring
    --> band + recommendation
    --> persist screening result

Rank all screened candidates by overall score, descending --> return shortlist
```

## 6. Technology Stack

| Layer            | Choice                          | Why |
|-------------------|----------------------------------|-----|
| Backend            | Python + FastAPI                | Strong NLP/LLM ecosystem, automatic OpenAPI docs, easy testing |
| Resume parsing     | PyMuPDF (`fitz`)                 | Fast, reliable PDF text extraction |
| LLM (primary)      | Google Gemini API                | Removes local-model RAM constraints; strong structured extraction/semantic matching |
| LLM (fallback)     | OpenRouter                       | Keeps the LLM layer provider-agnostic |
| Database           | SQLite (dev/demo)                | Zero-setup; code is written so PostgreSQL is a drop-in swap via `DATABASE_URL` |
| Frontend           | Streamlit                        | A polished working dashboard, fast |
| Testing            | pytest, FastAPI TestClient       | Full suite runs with zero network calls (LLM mocked) |

## 7. Project Structure

```text
smart-resume-screener/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app, CORS, exception handlers, lifespan
│   │   ├── api/                        # Thin route handlers (no business logic)
│   │   │   ├── routes_resumes.py
│   │   │   ├── routes_jobs.py
│   │   │   └── routes_screening.py
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic Settings (env-driven)
│   │   │   ├── logging.py
│   │   │   └── exceptions.py           # App error hierarchy -> HTTP status codes
│   │   ├── models/                     # SQLAlchemy ORM models
│   │   ├── schemas/                    # Pydantic request/response/domain schemas
│   │   ├── services/
│   │   │   ├── document_service.py     # File validation + OCR-required detection
│   │   │   ├── resume_parser.py        # PyMuPDF extraction + text cleaning
│   │   │   ├── job_parser.py           # Job description text cleaning
│   │   │   ├── extraction_service.py   # LLM extraction -> validated Pydantic profiles
│   │   │   ├── normalization_service.py# Skill alias normalization
│   │   │   ├── matching_service.py     # Hybrid deterministic + LLM matching engine
│   │   │   ├── scoring_service.py      # Deterministic weighted scoring
│   │   │   ├── ranking_service.py      # Sort candidates by score
│   │   │   ├── llm_service.py          # Provider-agnostic LLM facade
│   │   │   └── llm_providers/
│   │   │       ├── base.py
│   │   │       ├── gemini_provider.py
│   │   │       └── openrouter_provider.py
│   │   ├── prompts/                    # resume_extraction.txt, job_extraction.txt, candidate_matching.txt
│   │   └── db/
│   │       ├── database.py             # Engine/session setup
│   │       └── repositories.py         # All DB queries live here
│   └── requirements.txt
├── frontend/
│   └── app.py                          # Streamlit dashboard
├── tests/
│   ├── conftest.py                     # Mocked LLM + isolated in-memory DB fixtures
│   ├── unit/                           # PDF parsing, normalization, scoring, ranking
│   └── integration/                    # Full pipeline + full API (with error cases)
├── data/
│   ├── sample_resumes/                 # 5 resumes spanning strong/moderate/weak fit
│   └── sample_jobs/                    # 3 job descriptions
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── evaluation.md
├── pytest.ini
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

## 8. Data Models

### Candidate Profile (extracted from a resume)

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": null,
  "skills": [
    {"name": "Python", "category": "programming", "evidence": "3 years professional experience"}
  ],
  "experience": [
    {"company": "Example Technologies", "role": "Software Engineer", "duration_months": 30, "description": "..."}
  ],
  "education": [
    {"degree": "B.Tech", "field": "Computer Science", "institution": "Example University", "graduation_year": 2025}
  ],
  "projects": [
    {"name": "Resume Screener", "description": "..."}
  ],
  "total_experience_months": 30
}
```

**Rule: never invent candidate facts.** Any field that can't be determined
from the resume is `null` or an empty list — never guessed.

### Job Profile (extracted from a job description)

```json
{
  "title": "Machine Learning Engineer",
  "required_skills": ["Python", "Machine Learning", "PyTorch"],
  "preferred_skills": ["Docker", "AWS"],
  "minimum_experience_months": 24,
  "education_requirements": ["Computer Science", "Artificial Intelligence"],
  "responsibilities": ["Build machine learning models", "Deploy ML services"]
}
```

### Screening Result (stored per candidate x job)

Persisted fields: `overall_score`, `skill_score`, `experience_score`,
`responsibility_score`, `education_score`, matched/missing required and
preferred skills, `strengths`, `weaknesses`, `justification`, `match_band`,
`recommendation`. See `backend/app/models/screening.py` for the full schema.

## 9. Matching Algorithm

1. **Normalize** both the job's required/preferred skills and the candidate's
   skill list using a curated alias table (`normalization_service.py`) —
   `ML` → `machine learning`, `Python3` → `python`, `Postgres` → `postgresql`,
   etc. This alone resolves most matches deterministically.
2. **Ask the LLM** for a semantic match analysis (matched/missing skills,
   experience relevance evidence with a high/medium/low rating, strengths,
   weaknesses, a holistic `semantic_fit_score`, and a justification) — this
   catches equivalences the alias table doesn't know and provides the
   inherently-semantic judgments (experience relevance, responsibility
   alignment) a deterministic system can't compute from structured fields.
3. **Reconcile.** An LLM-claimed skill match is only trusted if the skill is
   actually a requirement of the job *and* is traceable to something in the
   candidate's own profile text (skills, evidence, project/experience
   descriptions). This stops the LLM from silently inventing a qualification.
   This is unit- and integration-tested directly — see
   `test_reconciliation`-style assertions in the matching tests.
4. **Score deterministically** (see below) using the reconciled matched/missing
   lists plus the LLM's experience-relevance and responsibility-alignment
   signals as *inputs*, not as the final number.
5. **Rank** all screened candidates by overall score, descending.

The LLM is explicitly *not* trusted to: invent qualifications, invent years of
experience or education, make protected-attribute-based decisions, or produce
an unexplained ranking. It receives structured information and returns
structured information, which the deterministic layer then checks.

## 10. Scoring Method

A 100-point weighted score:

| Component            | Weight |
|-----------------------|--------|
| Required Skills        | 45%   |
| Relevant Experience    | 30%   |
| Responsibilities       | 15%   |
| Education              | 10%   |

(These weights are a documented implementation choice, configurable via
`app/core/config.py` — not a hard requirement of the assignment.)

**Skill score**: 85% weight on required-skill coverage, 15% on preferred-skill
coverage, so a missing required skill costs more than a missing preferred one
(see `scoring_service.compute_skill_score`).

**Experience score**: `min(candidate total months / job minimum months, 1.0) x
100`, scaled by a relevance multiplier derived from the LLM's
`relevant_experience` evidence ratings (high=1.0, medium=0.75, low=0.5) — this
distinguishes *total* experience from *relevant* experience per the spec.

**Responsibility score**: derived from the LLM's holistic `semantic_fit_score`
(0-10 -> 0-100), since responsibility alignment is inherently a semantic
judgment not computable from structured fields alone. This is a documented
design decision (the spec doesn't fix a formula for this component).

**Education score**: 100 if the candidate's degree/field matches a stated
requirement, 60 if they have a degree but not in the required field, 0 if no
education is on file at all, 100 automatically if the job states no
requirement.

**Overall** = `0.45(skill) + 0.30(experience) + 0.15(responsibility) + 0.10(education)`,
then converted to a 1-10 display score as `overall / 10`.

**Bands** (configurable): Strong Match >= 90, Good Match >= 75, Partial Match
>= 60, else Low Match. **Recommendation**: Strong/Good -> `SHORTLIST`, Partial
-> `CONSIDER`, Low -> `REJECT`.

## 11. LLM Prompts

Full prompt text lives in `backend/app/prompts/` (loaded and filled at
runtime by `llm_service.py`). Summary of each:

- **`resume_extraction.txt`** — extracts candidate identity, skills,
  experience, education, and projects from raw resume text. Hard rules: never
  invent information, never infer missing dates or qualifications, return
  `null`/empty rather than guessing, return valid JSON only.
- **`job_extraction.txt`** — extracts title, required vs. preferred skills,
  minimum experience (converted to months), education requirements, and
  responsibilities from a job description. Hard rule: never merge required
  and preferred qualifications.
- **`candidate_matching.txt`** — compares a candidate profile against a job
  profile and returns matched/missing required and preferred skills, rated
  relevant-experience evidence, strengths, weaknesses, a 0-10
  `semantic_fit_score`, and a justification. Hard rules: use only evidence in
  the candidate profile, never invent qualifications, explicitly say when
  evidence is missing rather than guessing, and never consider protected
  attributes (age, gender, ethnicity, religion, marital status, etc.).

All three end with a strict "valid JSON only, matching this schema" contract,
and every response is validated against a Pydantic model
(`extraction_service.py`, `matching_service.py`) before it's trusted anywhere
downstream — a malformed or schema-violating response raises
`SchemaValidationError` / `LLMProviderError` rather than silently degrading.

## 12. API Endpoints

Interactive docs are auto-generated at `/docs` (Swagger) and `/redoc` once the
server is running.

| Method | Path                        | Description |
|--------|------------------------------|--------------|
| GET    | `/health`                    | Liveness check |
| POST   | `/api/resumes/upload`        | Upload a PDF/TXT resume; extracts + persists a candidate profile |
| GET    | `/api/resumes/{candidate_id}`| Fetch a stored candidate profile |
| GET    | `/api/resumes`               | List all stored candidates |
| POST   | `/api/jobs`                  | Create a job from a pasted description; extracts + persists a job profile |
| GET    | `/api/jobs/{job_id}`         | Fetch a stored job profile |
| GET    | `/api/jobs`                  | List all stored jobs |
| POST   | `/api/screen`                | Screen a list of candidate IDs against a job; returns a ranked shortlist |
| GET    | `/api/screen/{screening_id}` | Retrieve a previously-run screening batch |

See `docs/api.md` for full request/response examples.

### Error handling

| Status | Meaning |
|--------|---------|
| 400 | Invalid file type |
| 413 | File too large |
| 422 | Text extraction failed / schema validation failed / request body invalid |
| 404 | Candidate / job / screening not found |
| 502 | LLM provider failure |
| 500 | Unexpected server error |

Every error returns `{"error": "<ExceptionName>", "detail": "<message>"}` —
no stack traces or API keys are ever exposed to the client
(`app/main.py`'s exception handlers).

## 13. Installation

```bash
git clone <your-repo-url>
cd smart-resume-screener

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend deps are already included in requirements.txt (Streamlit)
cd ..
cp .env.example .env             # then fill in GEMINI_API_KEY
```

## 14. Environment Variables

See `.env.example` for the full, authoritative list. Key ones:

| Variable | Default | Notes |
|----------|---------|-------|
| `LLM_PROVIDER` | `gemini` | `gemini` or `openrouter` |
| `GEMINI_API_KEY` | *(required if using Gemini)* | Get one from Google AI Studio |
| `GEMINI_MODEL` | `gemini-2.0-flash` | |
| `OPENROUTER_API_KEY` | *(required if using OpenRouter)* | |
| `DATABASE_URL` | `sqlite:///./resume_screener.db` | Swap for a Postgres URL to move off SQLite |
| `MAX_FILE_SIZE_MB` | `10` | |

`.env` is git-ignored; only `.env.example` is committed.

## 15. Running the Application

```bash
# Terminal 1 - backend (from backend/)
uvicorn app.main:app --reload --port 8000

# Terminal 2 - frontend (from repo root)
streamlit run frontend/app.py
```

Then open the Streamlit URL it prints (typically http://localhost:8501),
paste a job description from `data/sample_jobs/`, upload a few resumes from
`data/sample_resumes/`, and click **SCREEN CANDIDATES**.

## 16. Testing

```bash
# From the repository root
pip install -r backend/requirements.txt
pytest
```

45 tests, all passing, **zero network calls required** — the LLM is mocked at
the `llm_service` boundary (see `tests/conftest.py`) so the full pipeline
(parsing, normalization, scoring, matching reconciliation, ranking,
persistence, and every API error path) is exercised without needing an API key.

```text
tests/unit/test_pdf_parser.py        - PDF/TXT extraction, OCR-required detection, validation
tests/unit/test_normalization.py     - skill alias normalization
tests/unit/test_scoring.py           - every scoring formula in isolation
tests/unit/test_ranking.py           - sort order, stability, ties
tests/integration/test_resume_pipeline.py  - raw text -> validated profile, end to end
tests/integration/test_screening_api.py    - full HTTP API: upload -> job -> screen -> retrieve,
                                              multi-candidate ranking, and every error status code
```

## 17. Sample Results

A representative screening result (this exact input/output pair is exercised
by `tests/integration/test_screening_api.py` with a mocked LLM, so it's
reproducible offline; running against a live Gemini key on the sample data in
`data/` will produce a similar shape with live-generated justifications):

**Job:** Machine Learning Engineer — required: Python, Machine Learning,
PyTorch; preferred: Docker, AWS, FastAPI; min. 24 months; Computer Science.

**Candidate:** Jane Smith — Python/ML/FastAPI skills, 30 months as an ML
Engineer building and deploying PyTorch models, B.Tech Computer Science.

```json
{
  "overall_score": 94.0,
  "overall_score_out_of_10": 9.4,
  "match_band": "Strong Match",
  "recommendation": "SHORTLIST",
  "matched_required_skills": ["Python", "Machine Learning", "PyTorch"],
  "missing_required_skills": [],
  "matched_preferred_skills": ["FastAPI"],
  "missing_preferred_skills": ["Docker", "AWS"],
  "strengths": ["Strong Python/ML background"],
  "weaknesses": ["No AWS evidence"],
  "justification": "Strong fit for the ML engineer role."
}
```

Run the app yourself against `data/sample_resumes/` and
`data/sample_jobs/ml_engineer.txt` with a live `GEMINI_API_KEY` to see the
full range: `priya_sharma.txt` (strong match), `arjun_mehta.txt` (moderate —
missing PyTorch), `sara_khan.txt` (weak — unrelated frontend background),
`devraj_singh.pdf` (strong skills, thin experience), and `neha_kapoor.pdf`
(strong experience, weak skill alignment for this specific role).

## 18. Limitations

- Scanned/image-only PDFs are detected (`OCR_REQUIRED`) but not OCR'd — this
  is called out as a P2/future enhancement, not a silent failure.
- The skill normalization alias table is intentionally small and curated for
  common cases, not an exhaustive skills ontology; anything it misses falls
  back to LLM semantic matching (with the reconciliation guard).
- Scoring weights and match-band thresholds are a documented, configurable
  starting point, not an empirically validated model.
- No authentication/authorization layer — appropriate for a local
  demo/assignment, not for production multi-tenant use as-is.
- No two-stage retrieval — every candidate in a screening batch gets a full
  LLM matching call. Fine at demo scale; would need a cheap pre-filter before
  the LLM step at (e.g.) 1000+ resumes.

## 19. Future Improvements

- OCR support for scanned resumes.
- Two-stage retrieval (cheap filter -> top-K -> LLM matching) for scale.
- Vector search over candidate profiles for fast initial retrieval.
- PostgreSQL in production (the code already avoids SQLite-specific
  assumptions - swapping `DATABASE_URL` is the only change needed).
- Batch/async screening for large candidate pools.
- Authentication and per-recruiter/team data isolation.
- A small labeled evaluation set (see `docs/evaluation.md`) to track
  extraction accuracy and ranking quality over time as prompts/weights change.

## 20. Demo

A 2-3 minute demo script:

1. **Problem (0:00-0:20)** — recruiters need to compare many resumes against
   one job description; this system extracts, matches, ranks, and explains.
2. **Upload (0:20-0:40)** — paste a job description, upload the 5 sample
   resumes, click **SCREEN CANDIDATES**.
3. **Results (0:40-1:20)** — show the ranked list; open the top candidate and
   walk through matched/missing skills, strengths, weaknesses, justification.
4. **Architecture (1:20-1:50)** — briefly show the PDF -> extraction ->
   structured profile -> hybrid matching -> ranking -> explanation pipeline
   (section 4 diagram above).
5. **Technical quality (1:50-2:20)** — mention FastAPI, structured schemas,
   SQLite persistence, the LLM prompts, schema validation, the 45-test suite,
   and the modular service architecture.
6. **Close (2:20-2:40)** — show the GitHub repo and commit history: "the
   system separates deterministic matching from LLM semantic reasoning so the
   result is explainable and testable."
