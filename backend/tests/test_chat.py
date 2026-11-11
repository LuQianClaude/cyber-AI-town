from fastapi.testclient import TestClient

from tests.conftest import auth_headers


def _setup(client: TestClient, tokens: dict, nickname: str = "聊者") -> tuple[str, str]:
    h = auth_headers(tokens)
    cfg = client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    ).json()["id"]
    rid = client.post(
        "/api/residents", json={"nickname": nickname, "model_config_id": cfg}, headers=h
    ).json()["id"]
    session = client.post("/api/chat/sessions", json={"kind": "dm", "resident_ids": [rid]}, headers=h).json()
    return rid, session["id"]


def test_dm_session_reused(client: TestClient, user_a: dict) -> None:
    h = auth_headers(user_a)
    rid = client.post("/api/residents", json={"nickname": "复用"}, headers=h).json()["id"]
    s1 = client.post("/api/chat/sessions", json={"kind": "dm", "resident_ids": [rid]}, headers=h).json()
    s2 = client.post("/api/chat/sessions", json={"kind": "dm", "resident_ids": [rid]}, headers=h).json()
    assert s1["id"] == s2["id"]


def test_chat_ws_full_roundtrip(client: TestClient, user_a: dict, mock_adapter: list) -> None:
    rid, sid = _setup(client, user_a)
    token = user_a["access_token"]
    with client.websocket_connect(f"/api/chat/ws/{sid}?token={token}") as ws:
        ws.send_json({"type": "user_message", "content": "你好呀"})
        events: list[dict] = []
        seen_stream = False
        while True:
            event = ws.receive_json()
            events.append(event)
            if event["type"] == "ai_stream":
                seen_stream = True
            if event["type"] == "ai_done":
                break
        types = [e["type"] for e in events]
        assert types[0] == "user_message"
        assert seen_stream
        done = events[-1]
        assert done["message"]["sender_resident_id"] == rid
        assert done["message"]["content"] == "你好，我是测试居民"
        # 消息已持久化
        msgs = client.get(f"/api/chat/sessions/{sid}/messages", headers=auth_headers(user_a)).json()
        assert [m["content"] for m in msgs] == ["你好呀", "你好，我是测试居民"]
        # 系统提示包含人格与默认身份
        assert any("聊者" in c for c in mock_adapter)


def test_chat_ws_unauthorized(client: TestClient, user_a: dict) -> None:
    import pytest
    from starlette.websockets import WebSocketDisconnect

    _, sid = _setup(client, user_a)
    with pytest.raises(WebSocketDisconnect) as exc1:
        with client.websocket_connect(f"/api/chat/ws/{sid}?token=bad"):
            pass
    assert exc1.value.code == 4401
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/chat/ws/{sid}"):
            pass


def test_non_participant_cannot_read_messages(client: TestClient, user_a: dict, user_b: dict) -> None:
    _, sid = _setup(client, user_a)
    res = client.get(f"/api/chat/sessions/{sid}/messages", headers=auth_headers(user_b))
    assert res.status_code == 403


def test_group_chat_both_residents_reply(client: TestClient, user_a: dict, mock_adapter: list) -> None:
    h = auth_headers(user_a)
    cfg = client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    ).json()["id"]
    r1 = client.post("/api/residents", json={"nickname": "甲", "model_config_id": cfg}, headers=h).json()["id"]
    r2 = client.post("/api/residents", json={"nickname": "乙", "model_config_id": cfg}, headers=h).json()["id"]
    sid = client.post(
        "/api/chat/sessions", json={"kind": "group", "name": "三人群", "resident_ids": [r1, r2]}, headers=h
    ).json()["id"]
    with client.websocket_connect(f"/api/chat/ws/{sid}?token={user_a['access_token']}") as ws:
        ws.send_json({"type": "user_message", "content": "大家早上好"})
        done_residents: set[str] = set()
        while len(done_residents) < 2:
            event = ws.receive_json()
            if event["type"] == "ai_done":
                done_residents.add(event["resident_id"])
        assert done_residents == {r1, r2}
