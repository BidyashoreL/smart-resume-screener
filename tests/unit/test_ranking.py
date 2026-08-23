from app.schemas.screening import CandidateScreeningResult, ScoreBreakdown
from app.services.ranking_service import rank_candidates


def _result(candidate_id: str, overall_score: float) -> CandidateScreeningResult:
    return CandidateScreeningResult(
        candidate_id=candidate_id,
        candidate_name=candidate_id,
        scores=ScoreBreakdown(
            skill_score=overall_score,
            experience_score=overall_score,
            responsibility_score=overall_score,
            education_score=overall_score,
            overall_score=overall_score,
        ),
        match_band="Good Match",
        recommendation="SHORTLIST",
        matched_required_skills=[],
        missing_required_skills=[],
        matched_preferred_skills=[],
        missing_preferred_skills=[],
        skill_evidence=[],
        strengths=[],
        weaknesses=[],
        justification="",
    )


def test_candidates_sorted_descending():
    results = [_result("A", 92), _result("B", 84), _result("C", 77), _result("D", 95), _result("E", 63)]
    ranked = rank_candidates(results)
    assert [r.candidate_id for r in ranked] == ["D", "A", "B", "C", "E"]


def test_ranking_does_not_mutate_input_list_order():
    results = [_result("A", 50), _result("B", 90)]
    rank_candidates(results)
    assert [r.candidate_id for r in results] == ["A", "B"]


def test_tied_scores_keep_stable_relative_order():
    results = [_result("A", 80), _result("B", 80), _result("C", 90)]
    ranked = rank_candidates(results)
    assert [r.candidate_id for r in ranked] == ["C", "A", "B"]
