from app.schemas.candidate import CandidateProfile
from app.schemas.job import JobProfile
from app.schemas.screening import LLMMatchAnalysis, RelevantExperienceEvidence
from app.services import scoring_service


def _job(**overrides) -> JobProfile:
    defaults = dict(
        title="ML Engineer",
        required_skills=["Python", "Machine Learning", "PyTorch"],
        preferred_skills=["Docker", "AWS"],
        minimum_experience_months=24,
        education_requirements=["Computer Science"],
        responsibilities=["Build models"],
    )
    defaults.update(overrides)
    return JobProfile(**defaults)


def _candidate(**overrides) -> CandidateProfile:
    defaults = dict(
        name="Test Candidate",
        skills=[{"name": "Python"}, {"name": "Machine Learning"}, {"name": "PyTorch"}],
        education=[{"degree": "B.Tech", "field": "Computer Science"}],
        total_experience_months=36,
    )
    defaults.update(overrides)
    return CandidateProfile(**defaults)


def _llm_analysis(**overrides) -> LLMMatchAnalysis:
    defaults = dict(
        relevant_experience=[RelevantExperienceEvidence(evidence="x", relevance="high")],
        semantic_fit_score=9,
    )
    defaults.update(overrides)
    return LLMMatchAnalysis(**defaults)


# --- Skill scoring ---------------------------------------------------------


def test_perfect_candidate_scores_high_on_skills():
    score = scoring_service.compute_skill_score(
        matched_required=["Python", "Machine Learning", "PyTorch"],
        missing_required=[],
        matched_preferred=["Docker", "AWS"],
        missing_preferred=[],
    )
    assert score == 100.0


def test_missing_required_skill_penalized_more_than_missing_preferred():
    score_missing_required = scoring_service.compute_skill_score(
        matched_required=["Python", "Machine Learning"],
        missing_required=["PyTorch"],
        matched_preferred=["Docker", "AWS"],
        missing_preferred=[],
    )
    score_missing_preferred = scoring_service.compute_skill_score(
        matched_required=["Python", "Machine Learning", "PyTorch"],
        missing_required=[],
        matched_preferred=["Docker"],
        missing_preferred=["AWS"],
    )
    assert score_missing_required < score_missing_preferred


def test_no_required_or_preferred_skills_scores_full_marks():
    score = scoring_service.compute_skill_score([], [], [], [])
    assert score == 100.0


# --- Experience scoring ----------------------------------------------------


def test_experience_meeting_minimum_with_high_relevance_scores_full():
    candidate = _candidate(total_experience_months=36)
    job = _job(minimum_experience_months=24)
    analysis = _llm_analysis(
        relevant_experience=[RelevantExperienceEvidence(evidence="x", relevance="high")]
    )
    score = scoring_service.compute_experience_score(candidate, job, analysis)
    assert score == 100.0


def test_experience_below_minimum_scores_lower():
    candidate = _candidate(total_experience_months=12)
    job = _job(minimum_experience_months=24)
    analysis = _llm_analysis()
    score = scoring_service.compute_experience_score(candidate, job, analysis)
    assert score < 100.0


def test_low_relevance_experience_penalized_versus_high_relevance():
    candidate = _candidate(total_experience_months=36)
    job = _job(minimum_experience_months=24)

    high_relevance = scoring_service.compute_experience_score(
        candidate, job, _llm_analysis(relevant_experience=[RelevantExperienceEvidence(evidence="x", relevance="high")])
    )
    low_relevance = scoring_service.compute_experience_score(
        candidate, job, _llm_analysis(relevant_experience=[RelevantExperienceEvidence(evidence="x", relevance="low")])
    )
    assert low_relevance < high_relevance


def test_no_minimum_experience_stated_does_not_penalize():
    candidate = _candidate(total_experience_months=3)
    job = _job(minimum_experience_months=None)
    analysis = _llm_analysis(
        relevant_experience=[RelevantExperienceEvidence(evidence="x", relevance="high")]
    )
    score = scoring_service.compute_experience_score(candidate, job, analysis)
    assert score == 100.0


# --- Education scoring ------------------------------------------------------


def test_education_match_scores_full():
    candidate = _candidate()
    job = _job(education_requirements=["Computer Science"])
    assert scoring_service.compute_education_score(candidate, job) == 100.0


def test_education_mismatch_but_has_degree_scores_partial():
    candidate = _candidate(education=[{"degree": "B.A.", "field": "History"}])
    job = _job(education_requirements=["Computer Science"])
    assert scoring_service.compute_education_score(candidate, job) == 60.0


def test_no_education_at_all_scores_zero_when_required():
    candidate = _candidate(education=[])
    job = _job(education_requirements=["Computer Science"])
    assert scoring_service.compute_education_score(candidate, job) == 0.0


def test_no_education_requirement_scores_full_regardless():
    candidate = _candidate(education=[])
    job = _job(education_requirements=[])
    assert scoring_service.compute_education_score(candidate, job) == 100.0


# --- Overall / band / recommendation ---------------------------------------


def test_overall_score_matches_weighted_formula():
    overall = scoring_service.compute_overall_score(
        skill_score=90, experience_score=80, responsibility_score=85, education_score=75
    )
    expected = round(0.45 * 90 + 0.30 * 80 + 0.15 * 85 + 0.10 * 75, 2)
    assert overall == expected


def test_match_band_thresholds():
    assert scoring_service.determine_match_band(95) == "Strong Match"
    assert scoring_service.determine_match_band(80) == "Good Match"
    assert scoring_service.determine_match_band(65) == "Partial Match"
    assert scoring_service.determine_match_band(40) == "Low Match"


def test_recommendation_follows_band():
    assert scoring_service.determine_recommendation("Strong Match") == "SHORTLIST"
    assert scoring_service.determine_recommendation("Good Match") == "SHORTLIST"
    assert scoring_service.determine_recommendation("Partial Match") == "CONSIDER"
    assert scoring_service.determine_recommendation("Low Match") == "REJECT"
