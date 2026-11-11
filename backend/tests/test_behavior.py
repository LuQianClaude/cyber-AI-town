# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.services.behavior import (
    BASELINE_MOOD,
    CHAT_MOOD_BUMP,
    activity_for,
    bump_mood,
    effective_mood,
    mood_line,
    mood_tier,
    resident_status,
)
from app.services.world_clock import clock_at, now_clock, phase_for_hour
from tests.conftest import auth_headers


# ---------------- 世界时钟 ----------------

def test_clock_phase_boundaries() -> None:
    assert phase_for_hour(0) == "night"
    assert phase_for_hour(4) == "night"
    assert phase_for_hour(5) == "dawn"
    assert phase_for_hour(6) == "dawn"
    assert phase_for_hour(7) == "morning"
    assert phase_for_hour(10) == "morning"
    assert phase_for_hour(11) == "noon"
    assert phase_for_hour(13) == "noon"
    assert phase_for_hour(14) == "afternoon"
    assert phase_for_hour(16) == "afternoon"
    assert phase_for_hour(17) == "evening"
    assert phase_for_hour(19) == "evening"
    assert phase_for_hour(20) == "night"
    assert phase_for_hour(23) == "night"


def test_clock_math_and_monotonic() -> None:
    t0 = datetime(2026, 11, 11, 0, 0, 0, tzinfo=timezone.utc)
    c0 = clock_at(t0)
    assert (c0.game_hour, c0.game_minute) == (0, 0)
    assert c0.phase == "night"
    c1 = clock_at(t0 + timedelta(seconds=90))  # +90 游戏分钟
    assert (c1.game_hour, c1.game_minute) == (1, 30)
    assert c1.tick == c0.tick + 90
    assert c1.day == c0.day
    # 跨天：24 现实分钟 = 1440 游戏分钟 = 1 游戏日（1 现实秒 = 1 游戏分钟）
    c2 = clock_at(t0 + timedelta(minutes=24))
    assert c2.day == c0.day + 1
    assert c2.tick % (24 * 60) == c0.tick % (24 * 60)


def test_now_clock_is_valid() -> None:
    c = now_clock()
    assert 0 <= c.game_hour <= 23
    assert c.phase in {"dawn", "morning", "noon", "afternoon", "evening", "night"}
    assert "第" in c.display


def test_activity_covers_all_phases() -> None:
    from app.services.world_clock import WorldClock

    for phase in ("dawn", "morning", "noon", "afternoon", "evening", "night"):
        label = activity_for(WorldClock(tick=0, day=0, game_hour=0, game_minute=0, phase=phase))
        assert isinstance(label, str) and label


# ---------------- 心情 ----------------

class _Resident:
    """最小居民替身，只暴露行为引擎需要的字段。"""

    def __init__(self, mood: int, updated_at: datetime) -> None:
        self.mood = mood
        self.mood_updated_at = updated_at


NOW = datetime(2026, 11, 11, 12, 0, 0, tzinfo=timezone.utc)


def test_mood_drift_toward_baseline() -> None:
    high = _Resident(80, NOW - timedelta(minutes=10))
    assert effective_mood(high, NOW) == 70  # 回落 10
    low = _Resident(40, NOW - timedelta(minutes=30))
    assert effective_mood(low, NOW) == BASELINE_MOOD  # 回升封顶 60
    exact = _Resident(60, NOW - timedelta(hours=5))
    assert effective_mood(exact, NOW) == 60
    fresh = _Resident(75, NOW)
    assert effective_mood(fresh, NOW) == 75  # 一分钟内不漂移


def test_mood_tier_and_line() -> None:
    assert mood_tier(30) == "低落"
    assert mood_tier(50) == "有些闷"
    assert mood_tier(70) == "平静"
    assert mood_tier(95) == "愉快"
    assert "心情" in mood_line(70)


def test_bump_mood_clamps_and_anchors(client) -> None:  # noqa: ANN001
    from app.db.session import SessionLocal
    from app.db.models import User
    from app.db.models.resident import AIResident

    db = SessionLocal()
    try:
        user = User(email="mood@test.dev", nickname="mood", password_hash="x")
        db.add(user)
        db.flush()
        resident = AIResident(owner_id=user.id, nickname="心情居民")
        db.add(resident)
        db.commit()
        resident.mood = 98
        resident.mood_updated_at = NOW  # 对齐锚点，消除自然漂移
        assert bump_mood(db, resident, CHAT_MOOD_BUMP, NOW) == 100  # 封顶
        resident.mood = 1
        resident.mood_updated_at = NOW
        assert bump_mood(db, resident, -10, NOW) == 0  # 封底
        assert resident.mood_updated_at == NOW.replace(tzinfo=None)  # SQLite 回流为 naive，锚点已更新
    finally:
        db.close()


def test_resident_status_shape() -> None:
    r = _Resident(70, NOW)
    st = resident_status(r, NOW)
    assert st["mood"] == 70
    assert st["activity"] == activity_for(st["clock"])
    assert st["clock"] == clock_at(NOW)  # 同一时刻时钟一致


# ---------------- API ----------------

def _make_resident(client: TestClient, tokens: dict, nickname: str = "引擎居民") -> dict:
    res = client.post("/api/residents", json={"nickname": nickname}, headers=auth_headers(tokens))
    assert res.status_code == 201, res.text
    return res.json()


def test_status_endpoint(client, user_a):  # noqa: ANN001
    rid = _make_resident(client, user_a)["id"]
    res = client.get(f"/api/residents/{rid}/status", headers=auth_headers(user_a))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["mood"] == 70
    assert body["activity"]
    assert body["clock"]["phase"] in {"dawn", "morning", "noon", "afternoon", "evening", "night"}
    assert "display" in body["clock"]

    # 未鉴权 / 越权
    assert client.get(f"/api/residents/{rid}/status").status_code == 401
    from tests.conftest import register
    from tests.conftest import auth_headers as _h

    other = register(client, "stranger-status@example.com")
    assert client.get(f"/api/residents/{rid}/status", headers=_h(other)).status_code == 404


def test_chat_reply_bumps_mood(client, user_a, mock_adapter):  # noqa: ANN001
    h = auth_headers(user_a)
    cfg = client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    ).json()["id"]
    rid = _make_resident(client, user_a)
    res = client.patch(
        f"/api/residents/{rid['id']}",
        json={"model_config_id": cfg},
        headers=h,
    )
    assert res.status_code == 200, res.text
    res = client.post(
        "/api/chat/sessions",
        json={"kind": "dm", "resident_ids": [rid["id"]]},
        headers=h,
    )
    assert res.status_code == 201, res.text
    sid = res.json()["id"]

    with client.websocket_connect(f"/api/chat/ws/{sid}?token={user_a['access_token']}") as ws:
        ws.send_json({"type": "user_message", "content": "在吗"})
        while True:
            event = ws.receive_json()
            if event["type"] == "ai_done":
                break
            assert event["type"] != "ai_error"

    status = client.get(f"/api/residents/{rid['id']}/status", headers=h).json()
    assert status["mood"] == min(100, 70 + CHAT_MOOD_BUMP)


def test_system_prompt_mentions_mood(client, user_a):  # noqa: ANN001
    from app.db.models import User
    from app.db.models.resident import AIResident
    from app.db.session import SessionLocal
    from app.services.llm import build_system_prompt

    rid = _make_resident(client, user_a)["id"]
    db = SessionLocal()
    try:
        resident = db.get(AIResident, rid)
        prompt = build_system_prompt(db, resident)
        assert "心情" in prompt
    finally:
        db.close()
