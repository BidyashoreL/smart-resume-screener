"""
RBAC tests focused on company/team management, which is restricted to
ADMIN (see app/api/routes_company.py). Recruiting endpoints (candidates,
jobs, screening) intentionally allow any authenticated company member in
this phase - only company-level administration is role-gated.
"""


def _create_member(test_client, admin_headers, *, email, role, password="MemberPass123!"):
    resp = test_client.post(
        "/api/company/users",
        json={
            "email": email,
            "password": password,
            "first_name": "F",
            "last_name": "L",
            "role": role,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_admin_can_view_and_update_company(test_client, register_user, auth_headers):
    admin = register_user(test_client, email="cadmin1@acme.dev", company_name="Original Name")
    headers = auth_headers(admin)

    get_resp = test_client.get("/api/company", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Original Name"

    patch_resp = test_client.patch(
        "/api/company", json={"name": "Renamed Inc", "industry": "Software"}, headers=headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Renamed Inc"
    assert patch_resp.json()["industry"] == "Software"


def test_admin_can_manage_team(test_client, register_user, auth_headers, login_user):
    admin = register_user(test_client, email="cadmin2@acme.dev", company_name="Team Co")
    headers = auth_headers(admin)

    created = _create_member(
        test_client, headers, email="newmember@acme.dev", role="RECRUITER"
    )
    assert created["role"] == "RECRUITER"
    assert created["is_active"] is True

    list_resp = test_client.get("/api/company/users", headers=headers)
    assert list_resp.status_code == 200
    emails = [u["email"] for u in list_resp.json()]
    assert "newmember@acme.dev" in emails
    assert "cadmin2@acme.dev" in emails

    patch_resp = test_client.patch(
        f"/api/company/users/{created['id']}", json={"role": "HIRING_MANAGER"}, headers=headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["role"] == "HIRING_MANAGER"

    # The new member can now log in with their role reflected.
    session = login_user(test_client, email="newmember@acme.dev", password="MemberPass123!")
    assert session["user"]["role"] == "HIRING_MANAGER"

    delete_resp = test_client.delete(f"/api/company/users/{created['id']}", headers=headers)
    assert delete_resp.status_code == 204

    # Deactivated members can no longer log in.
    login_resp = test_client.post(
        "/api/auth/login",
        json={"email": "newmember@acme.dev", "password": "MemberPass123!"},
    )
    assert login_resp.status_code == 401


def test_non_admin_cannot_view_or_manage_team(test_client, register_user, auth_headers, login_user):
    admin = register_user(test_client, email="cadmin3@acme.dev", company_name="Locked Co")
    admin_headers = auth_headers(admin)

    _create_member(test_client, admin_headers, email="recruiter3@acme.dev", role="RECRUITER")
    recruiter = login_user(test_client, email="recruiter3@acme.dev", password="MemberPass123!")
    recruiter_headers = auth_headers(recruiter)

    assert test_client.get("/api/company/users", headers=recruiter_headers).status_code == 403
    assert (
        test_client.post(
            "/api/company/users",
            json={
                "email": "another@acme.dev",
                "password": "Whatever123!",
                "first_name": "X",
                "last_name": "Y",
                "role": "VIEWER",
            },
            headers=recruiter_headers,
        ).status_code
        == 403
    )


def test_non_admin_cannot_modify_company(test_client, register_user, auth_headers, login_user):
    admin = register_user(test_client, email="cadmin4@acme.dev", company_name="HM Co")
    admin_headers = auth_headers(admin)

    _create_member(test_client, admin_headers, email="hm4@acme.dev", role="HIRING_MANAGER")
    hm = login_user(test_client, email="hm4@acme.dev", password="MemberPass123!")
    hm_headers = auth_headers(hm)

    # Read access is fine...
    assert test_client.get("/api/company", headers=hm_headers).status_code == 200
    # ...but modification is not.
    resp = test_client.patch("/api/company", json={"name": "Hijacked"}, headers=hm_headers)
    assert resp.status_code == 403


def test_viewer_can_still_read_company_profile(test_client, register_user, auth_headers, login_user):
    admin = register_user(test_client, email="cadmin5@acme.dev", company_name="Viewer Co")
    admin_headers = auth_headers(admin)

    _create_member(test_client, admin_headers, email="viewer5@acme.dev", role="VIEWER")
    viewer = login_user(test_client, email="viewer5@acme.dev", password="MemberPass123!")
    viewer_headers = auth_headers(viewer)

    resp = test_client.get("/api/company", headers=viewer_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Viewer Co"


def test_cannot_deactivate_last_active_admin(test_client, register_user, auth_headers):
    admin = register_user(test_client, email="soleadmin@acme.dev", company_name="Sole Co")
    headers = auth_headers(admin)
    admin_id = admin["user"]["id"]

    resp = test_client.delete(f"/api/company/users/{admin_id}", headers=headers)
    assert resp.status_code == 409
    assert resp.json()["error"] == "LastAdminError"


def test_cannot_demote_last_active_admin(test_client, register_user, auth_headers):
    admin = register_user(test_client, email="soleadmin2@acme.dev", company_name="Sole Co 2")
    headers = auth_headers(admin)
    admin_id = admin["user"]["id"]

    resp = test_client.patch(
        f"/api/company/users/{admin_id}", json={"role": "RECRUITER"}, headers=headers
    )
    assert resp.status_code == 409
    assert resp.json()["error"] == "LastAdminError"


def test_can_deactivate_admin_when_another_admin_exists(
    test_client, register_user, auth_headers
):
    admin = register_user(test_client, email="admin1@acme.dev", company_name="Two Admin Co")
    headers = auth_headers(admin)

    second_admin = _create_member(
        test_client, headers, email="admin2@acme.dev", role="ADMIN"
    )

    resp = test_client.delete(f"/api/company/users/{second_admin['id']}", headers=headers)
    assert resp.status_code == 204
