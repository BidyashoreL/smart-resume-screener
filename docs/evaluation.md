# Evaluation Notes

The assignment doesn't require formal ML evaluation, but a small, honest
evaluation story makes the system's claims checkable rather than asserted -
and is a much stronger interview answer than "it seemed to work."

## Evaluation dataset

`data/sample_resumes/` and `data/sample_jobs/` form a small controlled
benchmark, deliberately covering distinct categories so the matching engine's
behavior can be sanity-checked by eye:

| Resume | Expected category (vs. `ml_engineer.txt`) |
|--------|--------------------------|
| `priya_sharma.txt` | Strong match - all 3 required skills present, 30 months of directly relevant ML-engineering experience, matching education. |
| `arjun_mehta.txt`  | Moderate match - has Python/ML/AWS but not PyTorch specifically (missing one required skill); experience is ML-adjacent (scikit-learn, data pipelines) rather than deep learning. |
| `sara_khan.txt`    | Weak match - frontend background (React/TypeScript) with no ML skills or experience at all. |
| `devraj_singh.pdf` | Strong skills / weak experience - lists the right skills (PyTorch, deep learning, CV, NLP) but only 3 months of internship experience, well under the stated minimum. |
| `neha_kapoor.pdf`  | Strong experience / weak skill alignment - 9 years of strong backend engineering experience, but in Java/Spring/Kafka, with no ML skill overlap for this specific job. |

Running each of these through `POST /api/screen` against `ml_engineer.txt`
(with a live `GEMINI_API_KEY`) and eyeballing the resulting band/recommendation
against the "expected category" column above is the fastest way to sanity
-check a prompt or scoring-weight change before committing it.

`backend_engineer.txt` and `data_scientist.txt` are included so the same five
resumes can be screened against a different job, which is a good way to
confirm the system is genuinely comparing against the *job's* requirements
rather than producing a fixed per-candidate score.

## What to measure (and how)

### Extraction accuracy

For a small hand-labeled sample (e.g. manually list the "true" skills/
education/experience for the 5 sample resumes), compare against what
`POST /api/resumes/upload` actually extracts:

```text
skill extraction accuracy      = correctly-extracted skills / true skills
education extraction accuracy  = correctly-extracted degree+field / true degree+field
experience extraction accuracy = correctly-extracted company+role+duration / true values
```

### Ranking quality

If you assign an expected rank order to the 5 sample resumes for a given job
(as in the table above), compare it against the system's actual ranked order
after a screening run:

```text
Top-1 accuracy    = does the system's #1 pick match the expected #1?
Top-3 recall      = of the expected top-3, how many appear in the system's top-3?
Ranking agreement = Spearman correlation between expected rank and actual rank
```

### System reliability

Track these across a batch of real runs (they're cheap to log from
`llm_service.py` and the exception handlers in `main.py`):

```text
successful PDF extraction rate        = successful extractions / total PDF uploads
LLM structured-output validation rate = valid-on-first-try / total LLM extraction calls
API error rate                        = non-2xx responses / total requests
```

## Honesty about numbers

**Do not report benchmark numbers that haven't actually been measured.** This
document describes *how* to measure them, not fabricated results - filling in
real numbers requires running the system against a live LLM key, which this
build environment doesn't have network access to. If you're preparing this
for submission, run the dataset above yourself, record the actual numbers,
and drop them into a short table here before presenting it.
