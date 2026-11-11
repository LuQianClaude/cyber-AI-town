from fastapi.testclient import TestClient

from tests.conftest import auth_headers


def _create_config(client: TestClient, tokens: dict) -> str:
    res = client.post(
        "/api/model-configs",
        json={
            "name": "测试配置",
            "provider": "custom",
            "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test",
            "model": "test-model",
        },
        headers=auth_headers(tokens),
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_resident_crud_and_ownership(client: TestClient, user_a: dict, user_b: dict) -> None:
    h = auth_headers(user_a)
    cfg = _create_config(client, user_a)

    res = client.post(
        "/api/residents",
        json={
            "nickname": "晚晚",
            "persona": "温柔安静的画家",
            "avatar": {"hair": "#8B4513", "longHair": False},
            "model_config_id": cfg,
        },
        headers=h,
    )
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    assert res.json()["is_online"] is True
    assert res.json()["avatar"]["hair"] == "#8B4513"

    # 读取与列表
    assert client.get(f"/api/residents/{rid}", headers=h).json()["nickname"] == "晚晚"
    assert len(client.get("/api/residents", headers=h).json()) == 1

    # 他人不可见（防越权）
    assert client.get(f"/api/residents/{rid}", headers=auth_headers(user_b)).status_code == 404

    # 更新
    res = client.patch(f"/api/residents/{rid}", json={"nickname": "晚凝", "current_activity": "画画中"}, headers=h)
    assert res.json()["nickname"] == "晚凝"

    # 删除
    assert client.delete(f"/api/residents/{rid}", headers=h).status_code == 204
    assert client.get(f"/api/residents/{rid}", headers=h).status_code == 404


def test_resident_delete_cascades_orphan_sessions(client: TestClient, user_a: dict) -> None:
    h = auth_headers(user_a)
    rid = client.post("/api/residents", json={"nickname": "临时的"}, headers=h).json()["id"]
    session = client.post("/api/chat/sessions", json={"kind": "dm", "resident_ids": [rid]}, headers=h).json()
    assert client.delete(f"/api/residents/{rid}", headers=h).status_code == 204
    # 会话连同消息一并清除
    res = client.get(f"/api/chat/sessions/{session['id']}/messages", headers=h)
    assert res.status_code == 404


def test_model_config_never_leaks_api_key(client: TestClient, user_a: dict) -> None:
    h = auth_headers(user_a)
    _create_config(client, user_a)
    listed = client.get("/api/model-configs", headers=h).json()
    assert listed[0]["has_api_key"] is True
    assert "api_key" not in listed[0]
    assert "sk-test" not in str(listed)


def test_model_config_ssrf_guard(client: TestClient, user_a: dict, monkeypatch) -> None:
    # 测试环境默认放行私网地址（便于本地 mock 服务），此用例显式切到 production 验证防护
    from cryptography.fernet import Fernet

    monkeypatch.setenv("CYBER_ENV", "production")
    monkeypatch.setenv("CYBER_API_KEY_ENCRYPTION_KEY", Fernet.generate_key().decode())
    from app.core import config as config_module

    config_module.get_settings.cache_clear()
    res = client.post(
        "/api/model-configs",
        json={
            "name": "内网", "provider": "custom", "base_url": "http://169.254.169.254/",
            "api_key": "k", "model": "m",
        },
        headers=auth_headers(user_a),
    )
    assert res.status_code == 400
    config_module.get_settings.cache_clear()  # 防止 production 设置泄漏到其他用例


def test_model_config_test_endpoint(client: TestClient, user_a: dict, mock_adapter: list) -> None:
    h = auth_headers(user_a)
    cfg = _create_config(client, user_a)
    res = client.post(f"/api/model-configs/{cfg}/test", headers=h)
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["latency_ms"] is not None
    assert mock_adapter  # 确认真的走到了 adapter


def test_memory_crud(client: TestClient, user_a: dict) -> None:
    h = auth_headers(user_a)
    rid = client.post("/api/residents", json={"nickname": "记忆者"}, headers=h).json()["id"]
    m = client.post(f"/api/residents/{rid}/memories", json={"content": "用户喜欢雨天"}, headers=h)
    assert m.status_code == 201
    mid = m.json()["id"]
    assert len(client.get(f"/api/residents/{rid}/memories", headers=h).json()) == 1
    assert client.patch(f"/api/residents/memories/{mid}", json={"content": "用户喜欢雪天"}, headers=h).json()["content"] == "用户喜欢雪天"
    assert client.delete(f"/api/residents/memories/{mid}", headers=h).status_code == 204
