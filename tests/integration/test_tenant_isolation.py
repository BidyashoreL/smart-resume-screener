"""
Tenant isolation tests: a user authenticated for Company A must never be
able to read or act on Company B's candidates, jobs, screening results, or
analytics, even when it knows a valid id from the other company.
"""


def test_company_a_cannot_read_company_b_candidate(
    test_client, register_user, auth_headers, upload_resume
):
    company_a = register_user(test_client, email="a-admin@a.dev", company_name="Company A")
    company_b = register_user(test_client, email="b-admin@b.dev", company_name="Company B")

    candidate_id = upload_resume(test_client, auth_headers(company_b))

    resp = test_client.get(f"/api/resumes/{candidate_id}", headers=auth_headers(company_a))
    assert resp.status_code == 404


def test_company_a_cannot_list_into_company_b_candidates(
    test_client, register_user, auth_headers, upload_resume
):
    company_a = register_user(test_client, email="a1-admin@a.dev", company_name="Company A1")
    company_b = register_user(test_client, email="b1-admin@b.dev", company_name="Company B1")

    upload_resume(test_client, auth_headers(company_b))

    resp = test_client.get("/api/resumes", headers=auth_headers(company_a))
    assert resp.status_code == 200
    assert resp.json() == []


def test_company_a_cannot_read_company_b_job(test_client, register_user, auth_headers, create_job):
    company_a = register_user(test_client, email="a2-admin@a.dev", company_name="Company A2")
    company_b = register_user(test_client, email="b2-admin@b.dev", company_name="Company B2")

    job_id = create_job(test_client, auth_headers(company_b))

    resp = test_client.get(f"/api/jobs/{job_id}", headers=auth_headers(company_a))
    assert resp.status_code == 404


def test_company_a_cannot_screen_company_b_candidate(
    test_client, register_user, auth_headers, upload_resume, create_job
):
    company_a = register_user(test_client, email="a3-admin@a.dev", company_name="Company A3")
    company_b = register_user(test_client, email="b3-admin@b.dev", company_name="Company B3")

    b_headers = auth_headers(company_b)
    a_headers = auth_headers(company_a)

    candidate_id = upload_resume(test_client, b_headers)  # belongs to company B
    job_id = create_job(test_client, a_headers)  # belongs to company A

    resp = test_client.post(
        "/api/screen",
        json={"job_id": job_id, "candidate_ids": [candidate_id]},
        headers=a_headers,
    )
    assert resp.status_code == 404  # candidate not found *for this company*


def test_company_a_cannot_use_company_b_job_for_screening(
    test_client, register_user, auth_headers, upload_resume, create_job
):
    company_a = register_user(test_client, email="a4-admin@a.dev", company_name="Company A4")
    company_b = register_user(test_client, email="b4-admin@b.dev", company_name="Company B4")

    a_headers = auth_headers(company_a)
    b_headers = auth_headers(company_b)

    candidate_id = upload_resume(test_client, a_headers)  # company A's own candidate
    job_id = create_job(test_client, b_headers)  # company B's job

    resp = test_client.post(
        "/api/screen",
        json={"job_id": job_id, "candidate_ids": [candidate_id]},
        headers=a_headers,
    )
    assert resp.status_code == 404  # job not found *for this company*


def test_company_a_cannot_read_company_b_screening_result(
    test_client, register_user, auth_headers, upload_resume, create_job
):
    company_a = register_user(test_client, email="a5-admin@a.dev", company_name="Company A5")
    company_b = register_user(test_client, email="b5-admin@b.dev", company_name="Company B5")
    b_headers = auth_headers(company_b)

    candidate_id = upload_resume(test_client, b_headers)
    job_id = create_job(test_client, b_headers)
    screen_resp = test_client.post(
        "/api/screen",
        json={"job_id": job_id, "candidate_ids": [candidate_id]},
        headers=b_headers,
    )
    screening_id = screen_resp.json()["screening_id"]

    resp = test_client.get(f"/api/screen/{screening_id}", headers=auth_headers(company_a))
    assert resp.status_code == 404


def test_analytics_excludes_other_companies(
    test_client, register_user, auth_headers, upload_resume, create_job
):
    company_a = register_user(test_client, email="a6-admin@a.dev", company_name="Company A6")
    company_b = register_user(test_client, email="b6-admin@b.dev", company_name="Company B6")

    a_headers = auth_headers(company_a)
    b_headers = auth_headers(company_b)

    # Company B screens a candidate; Company A does nothing.
    candidate_id = upload_resume(test_client, b_headers)
    job_id = create_job(test_client, b_headers)
    test_client.post(
        "/api/screen",
        json={"job_id": job_id, "candidate_ids": [candidate_id]},
        headers=b_headers,
    )

    resp = test_client.get("/api/screen/analytics/overview", headers=a_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_candidates"] == 0
    assert body["active_jobs"] == 0
    assert body["total_screenings"] == 0
    assert body["candidates_screened"] == 0


def test_company_a_admin_cannot_modify_company_b_user(test_client, register_user, auth_headers):
    company_a = register_user(test_client, email="a7-admin@a.dev", company_name="Company A7")
    company_b = register_user(test_client, email="b7-admin@b.dev", company_name="Company B7")

    b_user_id = company_b["user"]["id"]
    resp = test_client.patch(
        f"/api/company/users/{b_user_id}",
        json={"role": "VIEWER"},
        headers=auth_headers(company_a),
    )
    assert resp.status_code == 404


def test_company_a_cannot_view_company_b_company_profile(test_client, register_user, auth_headers):
    """GET /api/company always returns the caller's OWN company - there is no
    id parameter to manipulate, so this asserts company B's data never leaks
    into company A's response even when both exist in the same database."""
    company_a = register_user(test_client, email="a8-admin@a.dev", company_name="Company A8")
    register_user(test_client, email="b8-admin@b.dev", company_name="Company B8")

    resp = test_client.get("/api/company", headers=auth_headers(company_a))
    assert resp.status_code == 200
    assert resp.json()["name"] == "Company A8"
