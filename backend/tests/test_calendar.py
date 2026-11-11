# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import pytest

from app.services.world_clock import now_clock
from tests.conftest import auth_headers

BASE = "/api/calendar"


def _make_resident(client, tokens, nickname="日历居民"):  # noqa: ANN001
    res = client.post("/api/residents", json={"nickname": nickname}, headers=auth_headers(tokens))
    assert res.status_code == 201, res.text
    return res.json()


def test_calendar_crud_and_isolation(client, user_a, user_b):  # noqa: ANN001
    h = auth_headers(user_a)
    rid = _make_resident(client, user_a)["id"]
    res = client.post(
        f"{BASE}/events",
        json={"title": "海边看日落", "content": "和日历居民一起", "game_day": 3, "game_hour": 18, "resident_id": rid},
        headers=h,
    )
    assert res.status_code == 201, res.text
    event = res.json()
    assert event["kind"] == "appointment" and event["resident_id"] == rid

    # 越权居民 404 / 区间查询
    stranger = _make_resident(client, user_b, "外人")
    assert client.post(
        f"{BASE}/events",
        json={"title": "x", "game_day": 1, "game_hour": 1, "resident_id": stranger["id"]},
        headers=h,
    ).status_code == 404
    assert client.get(f"{BASE}", params={"from_day": 0, "to_day": 10}, headers=h).json()[0]["events"][0]["title"] == "海边看日落"
    assert client.get(f"{BASE}", params={"from_day": 5, "to_day": 10}, headers=h).json() == []
    assert client.get(f"{BASE}", params={"from_day": 10, "to_day": 5}, headers=h).status_code == 400
    assert client.get(f"{BASE}", params={"from_day": 0, "to_day": 10}).status_code == 401

    # 属主隔离 + 删除
    assert client.get(f"{BASE}", params={"from_day": 0, "to_day": 10}, headers=auth_headers(user_b)).json() == []
    assert client.request("DELETE", f"{BASE}/events/{event['id']}", headers=h).status_code == 204
    assert client.request("DELETE", f"{BASE}/events/{event['id']}", headers=h).status_code == 404


def test_proactive_generates_daily_world_event(client, user_a, mock_adapter, monkeypatch):  # noqa: ANN001
    monkeypatch.setattr("app.services.proactive.PROACTIVE_MIN_INTERVAL_SECONDS", 0)
    h = auth_headers(user_a)
    client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    )
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["world_events"] == 1

    day = now_clock().day
    cal = client.get(f"{BASE}", params={"from_day": day, "to_day": day}, headers=h).json()
    assert len(cal) == 1
    ev = cal[0]["events"][0]
    assert ev["kind"] == "world" and ev["title"]

    # 同一天再 run 不重复生成
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["world_events"] == 0
    cal = client.get(f"{BASE}", params={"from_day": day, "to_day": day}, headers=h).json()
    assert len(cal[0]["events"]) == 1


def test_world_event_without_config_skipped(client, user_a, mock_adapter, monkeypatch):  # noqa: ANN001
    monkeypatch.setattr("app.services.proactive.PROACTIVE_MIN_INTERVAL_SECONDS", 0)
    h = auth_headers(user_a)
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["world_events"] == 0


def test_resident_delete_cleans_appointments(client, user_a):  # noqa: ANN001
    h = auth_headers(user_a)
    rid = _make_resident(client, user_a)["id"]
    client.post(
        f"{BASE}/events",
        json={"title": "约会", "game_day": 1, "game_hour": 12, "resident_id": rid},
        headers=h,
    )
    assert client.request("DELETE", f"/api/residents/{rid}", headers=h).status_code == 204
    from app.db.models.calendar import WorldEvent
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        assert db.query(WorldEvent).filter(WorldEvent.resident_id == rid).count() == 0
    finally:
        db.close()


def test_world_clock_endpoint(client, user_a):  # noqa: ANN001
    res = client.get(f"{BASE}/clock", headers=auth_headers(user_a))
    assert res.status_code == 200
    body = res.json()
    assert 0 <= body["game_hour"] <= 23 and body["phase"]
    assert "第" in body["display"] and body["tick"] > 0
    assert client.get(f"{BASE}/clock").status_code == 401


def test_greeting_prompt_mentions_world_event() -> None:
    from app.services.llm import proactive_prompt

    plain = proactive_prompt("greeting", "第 3 天 09:00", "晨间散步", 70)
    assert "世界事件" not in plain
    with_event = proactive_prompt(
        "greeting", "第 3 天 09:00", "晨间散步", 70,
        event_title="黄昏的流星雨", event_content="全镇的人都出来看了",
    )
    assert "黄昏的流星雨" in with_event and "全镇的人都出来看了" in with_event
    # 低心情变体同样带入事件
    low = proactive_prompt("greeting_low", "第 3 天 22:00", "睡觉了", 30, event_title="停电了")
    assert "停电了" in low
    # 提醒话术带约定标题
    remind = proactive_prompt("reminder", "第 3 天 17:00", "看日落", 70, event_title="海边看日落")
    assert "海边看日落" in remind


def test_reminder_due_window() -> None:
    from app.services.proactive import REMINDER_WINDOW_HOURS, reminder_due

    # 现在开始 2 小时内 → 提醒
    assert reminder_due(10, 12, 10, 12) is True
    assert reminder_due(10, 14, 10, 12) is True  # 边界：正好 2 小时后
    assert reminder_due(10, 15, 10, 12) is False  # 超出窗口
    assert reminder_due(10, 11, 10, 12) is False  # 已过去
    assert reminder_due(11, 0, 10, 23) is True  # 跨天边界（23 时 → 次日 0 时）
    assert REMINDER_WINDOW_HOURS == 2


def test_proactive_reminds_appointment_once(client, user_a, mock_adapter, monkeypatch):  # noqa: ANN001
    from app.services.world_clock import now_clock

    monkeypatch.setattr("app.services.proactive.PROACTIVE_MIN_INTERVAL_SECONDS", 0)
    h = auth_headers(user_a)
    client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    )
    rid = _make_resident(client, user_a)["id"]
    clock = now_clock()
    client.post(
        f"{BASE}/events",
        json={"title": "海边看日落", "game_day": clock.day, "game_hour": clock.game_hour, "resident_id": rid},
        headers=h,
    )
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["reminders"] == 1

    # 提醒落进 DM 会话（同一次 run 里还有一句当天的打招呼，共 2 条）；再次 run 不重复
    sessions = client.get("/api/chat/sessions", headers=h).json()
    dm = [s for s in sessions if rid in (s.get("resident_ids") or [])]
    assert dm, "提醒应创建 DM 会话"
    msgs = client.get(f"/api/chat/sessions/{dm[0]['id']}/messages", headers=h).json()
    assert len(msgs) == 2
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["reminders"] == 0
    msgs = client.get(f"/api/chat/sessions/{dm[0]['id']}/messages", headers=h).json()
    assert len(msgs) == 2


def test_fresh_world_event_boosts_mood(client, user_a, mock_adapter, monkeypatch):  # noqa: ANN001
    from app.services.proactive import EVENT_MOOD_BONUS

    monkeypatch.setattr("app.services.proactive.PROACTIVE_MIN_INTERVAL_SECONDS", 0)
    h = auth_headers(user_a)
    client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    )
    rid = _make_resident(client, user_a)["id"]
    res = client.post("/api/proactive/run", headers=h).json()
    assert res["world_events"] == 1 and res["mood_bonuses"] == 1

    status = client.get(f"/api/residents/{rid}/status", headers=h).json()
    assert status["mood"] == min(100, 70 + EVENT_MOOD_BONUS)
