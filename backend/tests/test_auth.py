from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def test_register_login_me_flow(client: TestClient) -> None:
    res = client.post(
        "/api/auth/register",
        json={"email": "flow@example.com", "password": "password-123", "nickname": "流程"},
    )
    assert res.status_code == 201
    tokens = res.json()
    assert tokens["access_token"] and tokens["refresh_token"]
    assert tokens["user"]["nickname"] == "流程"

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "flow@example.com"

    login = client.post("/api/auth/login", json={"email": "flow@example.com", "password": "password-123"})
    assert login.status_code == 200


def test_register_duplicate_email_rejected(client: TestClient) -> None:
    client.post("/api/auth/register", json={"email": "dup@example.com", "password": "password-123"})
    res = client.post("/api/auth/register", json={"email": "dup@example.com", "password": "password-123"})
    assert res.status_code == 409


def test_login_wrong_password(client: TestClient) -> None:
    client.post("/api/auth/register", json={"email": "wp@example.com", "password": "password-123"})
    res = client.post("/api/auth/login", json={"email": "wp@example.com", "password": "wrong-password"})
    assert res.status_code == 401


def test_weak_password_rejected(client: TestClient) -> None:
    res = client.post("/api/auth/register", json={"email": "weak@example.com", "password": "short"})
    assert res.status_code == 422


def test_refresh_rotates_token(client: TestClient) -> None:
    tokens = client.post(
        "/api/auth/register", json={"email": "rot@example.com", "password": "password-123"}
    ).json()
    res = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 200
    new_tokens = res.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]
    # 旧刷新令牌已作废
    again = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert again.status_code == 401


def test_delete_account_cascades(client: TestClient) -> None:
    tokens = client.post(
        "/api/auth/register", json={"email": "del@example.com", "password": "password-123"}
    ).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    client.post(
        "/api/model-configs",
        json={
            "name": "c", "provider": "custom", "base_url": "http://localhost:1/v1",
            "api_key": "k", "model": "m",
        },
        headers=headers,
    )
    client.post("/api/residents", json={"nickname": "小测"}, headers=headers)
    res = client.request("DELETE", "/api/auth/me", json={"password": "password-123"}, headers=headers)
    assert res.status_code == 204
    login = client.post("/api/auth/login", json={"email": "del@example.com", "password": "password-123"})
    assert login.status_code == 401


def test_expired_access_token_rejected(client: TestClient) -> None:
    import jwt

    from app.core.config import get_settings

    token = jwt.encode(
        {
            "sub": "nobody",
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "type": "access",
        },
        get_settings().SECRET_KEY,
        algorithm="HS256",
    )
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
