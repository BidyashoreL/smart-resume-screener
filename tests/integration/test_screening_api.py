"""
Integration tests against the real FastAPI app (via TestClient), covering
the full flow: upload resume -> create job -> screen -> retrieve, plus the
API's error-handling behavior. The LLM is mocked (see tests/conftest.py);
everything else (PDF/text parsing, normalization, scoring, ranking,
persistence, HTTP status codes) is real.

Phase 7: every recruiting endpoint now requires authentication, so each test
registers a company/admin (see `register_user`/`auth_headers` fixtures in
tests/conftest.py) and sends the resulting bearer token on every request.
Only the auth wiring changed here - every original assertion is unchanged.
"""

import io


def _upload_resume(client, headers, filename="resume.txt", content=None):
    content = content or (
        b"Jane Smith\nEmail: jane@example.com\nSkills: Python, ML, FastAPI\n"
        b"Experience: ML Engineer at Acme, 30 months, built and deployed ML models\n"
        b"Education: B.Tech Computer Science, XYZ University, 2021\n"
    )
    resp = client.post(
        "/api/resumes/upload",
        files={"file": (filename, io.BytesIO(content), "text/plain")},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["candidate_id"]


def _create_job(client, headers):
    resp = client.post(
        "/api/jobs",
        json={
            "description": (
                "We are hiring a Machine Learning Engineer. Required: Python, "
                "Machine Learning, PyTorch. Preferred: Docker, AWS, FastAPI. "
                "Minimum 2 years experience. Requires a degree in Computer Science. "
                "Responsibilities: build machine learning models and deploy ML services."
            )
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["job_id"]


def test_health_check(test_client):
    resp = test_client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_full_screening_flow_returns_ranked_shortlist(test_client, register_user, auth_headers):
    headers = auth_headers(register_user(test_client))
    candidate_id = _upload_resume(test_client, headers)
    job_id = _create_job(test_client, headers)

    resp = test_client.post(
        "/api/screen", json={"job_id": job_id, "candidate_ids": [candidate_id]}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["job_id"] == job_id
    assert len(body["results"]) == 1

    result = body["results"][0]
    assert result["candidate_id"] == candidate_id
    assert result["match_band"] in ("Strong Match", "Good Match", "Partial Match", "Low Match")
    assert result["recommendation"] in ("SHORTLIST", "CONSIDER", "REJECT")
    assert 0 <= result["scores"]["overall_score"] <= 100
    assert "Python" in result["matched_required_skills"]


def test_screening_persists_and_can_be_retrieved(test_client, register_user, auth_headers):
    headers = auth_headers(register_user(test_client))
    candidate_id = _upload_resume(test_client, headers)
    job_id = _create_job(test_client, headers)

    screen_resp = test_client.post(
        "/api/screen", json={"job_id": job_id, "candidate_ids": [candidate_id]}, headers=headers
    )
    screening_id = screen_resp.json()["screening_id"]

    get_resp = test_client.get(f"/api/screen/{screening_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["results"][0]["candidate_id"] == candidate_id


def test_candidates_are_ranked_descending_in_multi_candidate_screening(
    test_client, fake_llm, register_user, auth_headers
):
    headers = auth_headers(register_user(test_client))
    strong_candidate_id = _upload_resume(test_client, headers, filename="strong.txt")

    # A second candidate the mocked LLM will judge as a much weaker fit.
    fake_llm.extract_resume.return_value = {
        "name": "Weak Fit",
        "email": "weak@example.com",
        "phone": None,
        "skills": [{"name": "HTML"}],
        "experience": [],
        "education": [],
        "projects": [],
        "total_experience_months": 0,
    }
    weak_candidate_id = _upload_resume(
        test_client, headers, filename="weak.txt", content=b"Weak Fit\nSkills: HTML\n"
    )

    fake_llm.match_candidate.side_effect = [
        {  # first call: strong candidate
            "matched_required_skills": ["Python", "Machine Learning", "PyTorch"],
            "missing_required_skills": [],
            "matched_preferred_skills": ["FastAPI"],
            "missing_preferred_skills": ["Docker", "AWS"],
            "relevant_experience": [{"evidence": "x", "relevance": "high"}],
            "strengths": ["Strong fit"],
            "weaknesses": [],
            "semantic_fit_score": 9,
            "justification": "Strong candidate.",
        },
        {  # second call: weak candidate
            "matched_required_skills": [],
            "missing_required_skills": ["Python", "Machine Learning", "PyTorch"],
            "matched_preferred_skills": [],
            "missing_preferred_skills": ["Docker", "AWS", "FastAPI"],
            "relevant_experience": [],
            "strengths": [],
            "weaknesses": ["No relevant skills"],
            "semantic_fit_score": 1,
            "justification": "Not a fit for this role.",
        },
    ]

    job_id = _create_job(test_client, headers)
    resp = test_client.post(
        "/api/screen",
        json={"job_id": job_id, "candidate_ids": [weak_candidate_id, strong_candidate_id]},
        headers=headers,
    )
    assert resp.status_code == 200
    results = resp.json()["results"]

    # Regardless of request order, the ranked response must put the stronger candidate first.
    assert results[0]["candidate_id"] == strong_candidate_id
    assert results[1]["candidate_id"] == weak_candidate_id
    assert results[0]["scores"]["overall_score"] > results[1]["scores"]["overall_score"]


def test_upload_rejects_unsupported_file_type(test_client, register_user, auth_headers):
    headers = auth_headers(register_user(test_client))
    resp = test_client.post(
        "/api/resumes/upload",
        files={"file": ("resume.exe", io.BytesIO(b"not a resume"), "application/octet-stream")},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "InvalidFileTypeError"


def test_screen_with_unknown_job_id_returns_404(test_client, register_user, auth_headers):
    headers = auth_headers(register_user(test_client))
    candidate_id = _upload_resume(test_client, headers)
    resp = test_client.post(
        "/api/screen",
        json={"job_id": "job_does_not_exist", "candidate_ids": [candidate_id]},
        headers=headers,
    )
    assert resp.status_code == 404
    assert resp.json()["error"] == "JobNotFoundError"


def test_screen_with_unknown_candidate_id_returns_404(test_client, register_user, auth_headers):
    headers = auth_headers(register_user(test_client))
    job_id = _create_job(test_client, headers)
    resp = test_client.post(
        "/api/screen",
        json={"job_id": job_id, "candidate_ids": ["candidate_does_not_exist"]},
        headers=headers,
    )
    assert resp.status_code == 404
    assert resp.json()["error"] == "CandidateNotFoundError"


def test_get_unknown_screening_returns_404(test_client, register_user, auth_headers):
    headers = auth_headers(register_user(test_client))
    resp = test_client.get("/api/screen/screening_does_not_exist", headers=headers)
    assert resp.status_code == 404
    assert resp.json()["error"] == "ScreeningNotFoundError"


def test_job_description_too_short_returns_422(test_client, register_user, auth_headers):
    headers = auth_headers(register_user(test_client))
    resp = test_client.post("/api/jobs", json={"description": "too short"}, headers=headers)
    assert resp.status_code == 422


def test_recruiting_endpoints_require_authentication(test_client):
    """Regression guard: unauthenticated requests to protected recruiting
    endpoints must be rejected, not silently served."""
    assert test_client.get("/api/resumes").status_code == 401
    assert test_client.get("/api/jobs").status_code == 401
    assert test_client.get("/api/screen/analytics/overview").status_code == 401
    assert (
        test_client.post("/api/screen", json={"job_id": "x", "candidate_ids": ["y"]}).status_code
        == 401
    )


def test_analytics_reflects_authenticated_companys_screening(
    test_client, register_user, auth_headers
):
    """Regression guard for the Phase 5/6 analytics endpoint under auth: it
    must still return correct, live-computed numbers for the caller's company."""
    headers = auth_headers(register_user(test_client))
    candidate_id = _upload_resume(test_client, headers)
    job_id = _create_job(test_client, headers)
    test_client.post(
        "/api/screen", json={"job_id": job_id, "candidate_ids": [candidate_id]}, headers=headers
    )

    resp = test_client.get("/api/screen/analytics/overview", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_candidates"] == 1
    assert body["active_jobs"] == 1
    assert body["total_screenings"] == 1
    assert body["candidates_screened"] == 1
