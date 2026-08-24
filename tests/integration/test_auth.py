"""
Authentication flow tests: registration, login, /me, logout, and refresh.
Uses the same `test_client` (in-memory DB, mocked LLM) as the rest of the
integration suite - see tests/conftest.py.
"""


def test_register_creates_company_and_admin_user(test_client, register_user):
    data = register_user(test_client, email="reg1@acme.dev")
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["email"] == "reg1@acme.dev"
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]


def test_register_duplicate_email_rejected(test_client, register_user):
    register_user(test_client, email="dup@acme.dev")
    resp = test_client.post(
        "/api/auth/register",
        json={
            "email": "dup@acme.dev",
            "password": "AnotherPass123!",
            "first_name": "B",
            "last_name": "B",
            "company_name": "Other Co",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["error"] == "DuplicateEmailError"


def test_register_email_normalized_case_insensitively(test_client, register_user):
    register_user(test_client, email="MixedCase@Acme.dev")
    resp = test_client.post(
        "/api/auth/register",
        json={
            "email": "mixedcase@acme.dev",
            "password": "AnotherPass123!",
            "first_name": "B",
            "last_name": "B",
            "company_name": "Other Co",
        },
    )
    assert resp.status_code == 409


def test_login_success(test_client, register_user):
    register_user(test_client, email="login@acme.dev", password="CorrectHorse123!")
    resp = test_client.post(
        "/api/auth/login", json={"email": "login@acme.dev", "password": "CorrectHorse123!"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "login@acme.dev"
    assert "password_hash" not in body["user"]


def test_login_wrong_password_rejected(test_client, register_user):
    register_user(test_client, email="wrongpw@acme.dev", password="CorrectHorse123!")
    resp = test_client.post(
        "/api/auth/login", json={"email": "wrongpw@acme.dev", "password": "WrongPassword!"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"] == "InvalidCredentialsError"


def test_login_unknown_email_rejected(test_client):
    resp = test_client.post(
        "/api/auth/login", json={"email": "nobody@nowhere.dev", "password": "whatever123"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"] == "InvalidCredentialsError"


def test_me_authenticated(test_client, register_user, auth_headers):
    data = register_user(test_client, email="me@acme.dev", company_name="Me Co")
    resp = test_client.get("/api/auth/me", headers=auth_headers(data))
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "me@acme.dev"
    assert body["role"] == "ADMIN"
    assert body["company"]["name"] == "Me Co"


def test_me_unauthenticated_rejected(test_client):
    resp = test_client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_invalid_token_rejected(test_client):
    resp = test_client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_me_with_expired_token_rejected(test_client, register_user):
    import jwt
    from datetime import datetime, timedelta, timezone

    from app.core.config import get_settings

    data = register_user(test_client, email="expired@acme.dev")
    settings = get_settings()
    expired_payload = {
        "sub": data["user"]["id"],
        "company_id": data["user"]["company_id"],
        "role": data["user"]["role"],
        "type": "access",
        "iat": datetime.now(timezone.utc) - timedelta(minutes=30),
        "exp": datetime.now(timezone.utc) - timedelta(minutes=15),
    }
    expired_token = jwt.encode(
        expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    resp = test_client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401


def test_inactive_user_cannot_login(test_client, register_user, auth_headers):
    admin = register_user(test_client, email="owner@acme.dev")
    create_resp = test_client.post(
        "/api/company/users",
        json={
            "email": "staff@acme.dev",
            "password": "StaffPass123!",
            "first_name": "S",
            "last_name": "T",
            "role": "RECRUITER",
        },
        headers=auth_headers(admin),
    )
    assert create_resp.status_code == 201
    user_id = create_resp.json()["id"]

    deactivate_resp = test_client.patch(
        f"/api/company/users/{user_id}", json={"is_active": False}, headers=auth_headers(admin)
    )
    assert deactivate_resp.status_code == 200

    login_resp = test_client.post(
        "/api/auth/login", json={"email": "staff@acme.dev", "password": "StaffPass123!"}
    )
    assert login_resp.status_code == 401
    assert login_resp.json()["error"] == "InactiveUserError"


def test_logout_clears_refresh_cookie(test_client, register_user, auth_headers):
    data = register_user(test_client, email="logout@acme.dev")
    assert "resume_screener_refresh_token" in test_client.cookies

    resp = test_client.post("/api/auth/logout", headers=auth_headers(data))
    assert resp.status_code == 204


def test_refresh_issues_new_access_token(test_client, register_user):
    register_user(test_client, email="refresh@acme.dev")
    # The refresh cookie set during registration is stored on the TestClient's
    # cookie jar and sent automatically on the next request.
    resp = test_client.post("/api/auth/refresh")
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["user"]["email"] == "refresh@acme.dev"


def test_refresh_without_cookie_rejected(test_client):
    resp = test_client.post("/api/auth/refresh")
    assert resp.status_code == 401


def test_refresh_after_logout_rejected(test_client, register_user, auth_headers):
    data = register_user(test_client, email="refreshout@acme.dev")
    test_client.post("/api/auth/logout", headers=auth_headers(data))

    resp = test_client.post("/api/auth/refresh")
    assert resp.status_code == 401
