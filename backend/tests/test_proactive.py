# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import pytest

from app.services.proactive import (
    LETTER_AFTER_DAYS,
    LETTER_MIN_MOOD,
    greeting_due,
    letter_due,
    plan_for_resident,
)
from tests.conftest import auth_headers


def test_due_rules() -> None:
    # 来信：从未收到 / 满 2 个游戏日 → 该写；心情太差不写
    assert letter_due(None, 10, 70) is True
    assert letter_due(8, 10, 70) is True  # 差 2 天
    assert letter_due(9, 10, 70) is False  # 差 1 天
    assert letter_due(8, 10, LETTER_MIN_MOOD - 1) is False
    # 打招呼：今天没说过话 → 该打
    assert greeting_due(None, 10) is True
    assert greeting_due(9, 10) is True
    assert greeting_due(10, 10) is False


def test_plan_variants() -> None:
    # 心情好：写信 + 普通打招呼
    p = plan_for_resident(last_incoming_letter_day=8, last_resident_chat_day=9, now_day=10, mood=70)
    assert p.letter and p.greeting and not p.greeting_low
    # 心情差：不写闲聊信，但触发「想找人说话」
    p = plan_for_resident(last_incoming_letter_day=8, last_resident_chat_day=9, now_day=10, mood=30)
    assert not p.letter and not p.greeting and p.greeting_low
    # 今天已聊过：不打招呼，但满 2 天没收到信仍主动来信
    p = plan_for_resident(last_incoming_letter_day=8, last_resident_chat_day=10, now_day=10, mood=70)
    assert p.letter and not p.greeting and not p.greeting_low
    assert LETTER_AFTER_DAYS == 2


@pytest.fixture()
def setup(client, user_a, mock_adapter, monkeypatch):  # noqa: ANN001
    monkeypatch.setattr("app.services.proactive.PROACTIVE_MIN_INTERVAL_SECONDS", 0)
    h = auth_headers(user_a)
    cfg = client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    ).json()["id"]
    resident = client.post("/api/residents", json={"nickname": "主动居民"}, headers=h).json()
    client.patch(f"/api/residents/{resident['id']}", json={"model_config_id": cfg}, headers=h)
    return {"tokens": user_a, "headers": h, "resident": resident}


def test_run_materializes_letter_and_greeting(client, setup):  # noqa: ANN001
    h, rid = setup["headers"], setup["resident"]["id"]
    res = client.post("/api/proactive/run", headers=h)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["letters"] == 1 and body["greetings"] == 1 and not body["skipped"]

    # 主动来信进了信箱（未读、无来信对象——reply_to 为空）
    summary = client.get("/api/mailbox/summary", headers=h).json()
    mine = [s for s in summary if s["resident_id"] == rid]
    assert mine[0]["unread_count"] == 1
    thread = client.get("/api/mailbox/letters", params={"resident_id": rid}, headers=h).json()
    assert len(thread) == 1 and thread[0]["reply_to_id"] is None and thread[0]["content"]

    # 打招呼进了 DM 会话
    res = client.get("/api/chat/sessions", headers=h)
    sessions = res.json()
    dm = [s for s in sessions if rid in s["resident_ids"]]
    assert len(dm) == 1
    res = client.get(f"/api/chat/sessions/{dm[0]['id']}/messages", headers=h)
    assert res.status_code == 200
    msgs = res.json()
    assert len(msgs) == 1 and msgs[0]["sender_resident_id"] == rid

    # 立即再 run：规则上不再重复（今天已聊、今天已收到信）
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["letters"] == 0 and res["greetings"] == 0


def test_run_throttle(client, setup, monkeypatch):  # noqa: ANN001
    monkeypatch.setattr("app.services.proactive.PROACTIVE_MIN_INTERVAL_SECONDS", 3600)
    h = setup["headers"]
    assert client.post("/api/proactive/run", headers=h).json()["letters"] == 1
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["skipped"] is True and res["letters"] == 0


def test_run_skips_unconfigured_resident(client, user_a, mock_adapter, monkeypatch):  # noqa: ANN001
    monkeypatch.setattr("app.services.proactive.PROACTIVE_MIN_INTERVAL_SECONDS", 0)
    h = auth_headers(user_a)
    client.post("/api/residents", json={"nickname": "无配置"}, headers=h)
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["letters"] == 0 and res["greetings"] == 0


def test_run_requires_auth(client):  # noqa: ANN001
    assert client.post("/api/proactive/run").status_code == 401
