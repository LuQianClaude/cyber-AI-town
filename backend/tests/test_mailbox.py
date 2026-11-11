# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth_headers

BASE = "/api/mailbox"


def _make_resident(client: TestClient, tokens: dict, nickname: str) -> dict:
    res = client.post("/api/residents", json={"nickname": nickname}, headers=auth_headers(tokens))
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture()
def setup(client, user_a, mock_adapter):  # noqa: ANN001
    """一个配好模型的居民 + 备用用户。"""
    h = auth_headers(user_a)
    cfg = client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    ).json()["id"]
    resident = _make_resident(client, user_a, "信友")
    client.patch(f"/api/residents/{resident['id']}", json={"model_config_id": cfg}, headers=h)
    return {"tokens": user_a, "headers": h, "resident": resident}


def test_send_letter_triggers_reply(client, setup):  # noqa: ANN001
    h, rid = setup["headers"], setup["resident"]["id"]
    res = client.post(f"{BASE}/letters", json={"resident_id": rid, "content": "最近好吗？"}, headers=h)
    assert res.status_code == 201, res.text
    letter = res.json()
    assert letter["sender_kind"] == "user" and letter["is_read"] is True

    # TestClient 同步执行 BackgroundTasks：回信已生成
    thread = client.get(f"{BASE}/letters", params={"resident_id": rid}, headers=h).json()
    assert len(thread) == 2
    reply = thread[1]
    assert reply["sender_kind"] == "resident"
    assert reply["reply_to_id"] == letter["id"]
    assert reply["is_read"] is False
    assert reply["content"]  # mock adapter 有固定内容


def test_send_letter_requires_owned_resident(client, setup, user_b):  # noqa: ANN001
    stranger = _make_resident(client, user_b, "外人")
    res = client.post(
        f"{BASE}/letters",
        json={"resident_id": stranger["id"], "content": "hi"},
        headers=setup["headers"],
    )
    assert res.status_code == 404
    assert client.post(f"{BASE}/letters", json={"resident_id": "nope", "content": "hi"}, headers=setup["headers"]).status_code == 404
    # 未鉴权
    assert client.post(f"{BASE}/letters", json={"resident_id": setup["resident"]["id"], "content": "hi"}).status_code == 401


def test_send_letter_without_config_no_reply(client, user_a):  # noqa: ANN001
    h = auth_headers(user_a)
    resident = _make_resident(client, user_a, "无配置")
    res = client.post(f"{BASE}/letters", json={"resident_id": resident["id"], "content": "你好"}, headers=h)
    assert res.status_code == 201
    thread = client.get(f"{BASE}/letters", params={"resident_id": resident["id"]}, headers=h).json()
    assert len(thread) == 1  # 无模型配置 → 只保存来信，静默跳过回信


def test_summary_and_read(client, setup):  # noqa: ANN001
    h, rid = setup["headers"], setup["resident"]["id"]
    client.post(f"{BASE}/letters", json={"resident_id": rid, "content": "第一封"}, headers=h)

    summary = client.get(f"{BASE}/summary", headers=h).json()
    mine = [s for s in summary if s["resident_id"] == rid]
    assert len(mine) == 1
    assert mine[0]["nickname"] == "信友"
    assert mine[0]["unread_count"] == 1  # 回信未读
    assert mine[0]["last_letter_at"] is not None

    # 另一居民无信件不出现在 summary
    other = _make_resident(client, setup["tokens"], "无信")
    summary = client.get(f"{BASE}/summary", headers=h).json()
    assert other["id"] not in {s["resident_id"] for s in summary}

    # 标记已读
    thread = client.get(f"{BASE}/letters", params={"resident_id": rid}, headers=h).json()
    reply_id = [t for t in thread if t["sender_kind"] == "resident"][0]["id"]
    res = client.post(f"{BASE}/letters/{reply_id}/read", headers=h)
    assert res.status_code == 200 and res.json()["is_read"] is True
    summary = client.get(f"{BASE}/summary", headers=h).json()
    assert [s for s in summary if s["resident_id"] == rid][0]["unread_count"] == 0

    # 越权标记 404
    assert client.post(f"{BASE}/letters/{reply_id}/read").status_code == 401


def test_resident_delete_cleans_letters(client, setup):  # noqa: ANN001
    h, rid = setup["headers"], setup["resident"]["id"]
    client.post(f"{BASE}/letters", json={"resident_id": rid, "content": "再见"}, headers=h)
    res = client.request("DELETE", f"/api/residents/{rid}", headers=h)
    assert res.status_code == 204
    from app.db.models.mailbox import MailboxLetter
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        assert db.query(MailboxLetter).filter(MailboxLetter.resident_id == rid).count() == 0
    finally:
        db.close()
    # 信箱 summary 不再出现
    assert all(s["resident_id"] != rid for s in client.get(f"{BASE}/summary", headers=h).json())
