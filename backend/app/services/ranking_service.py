"""
Ranking engine (section 22 of the spec).

Takes a batch of already-scored `CandidateScreeningResult`s and returns them
sorted by overall score, descending. Deliberately trivial - all of the
interesting decisions (what the score means, what band a score falls into)
already happened in `scoring_service`. Kept as its own module because the
spec calls it out as a distinct stage in the pipeline and because a future
change (e.g. tie-breaking rules, diversity-of-shortlist logic) would live
here without touching scoring.
"""

from app.schemas.screening import CandidateScreeningResult


def rank_candidates(
    results: list[CandidateScreeningResult],
) -> list[CandidateScreeningResult]:
    """Sort candidates by overall score, descending. Ties keep input order (stable sort)."""
    return sorted(results, key=lambda r: r.scores.overall_score, reverse=True)
