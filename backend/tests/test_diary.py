# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import pytest
from fastapi.testclient import TestClient

from app.services.diary import DIARY_MOOD_SWING, diary_due
from tests.conftest import auth_headers


def test_diary_due_rules() -> None:
    # 第一篇
    assert diary_due(None, 5, None, 70).due and diary_due(None, 5, None, 70).trigger == "first"
    # 跨游戏日
    assert diary_due(5, 6, 70, 70).trigger == "new_day"
    # 同日心情波动
    assert diary_due(5, 5, 70, 70 + DIARY_MOOD_SWING).trigger == "mood_swing"
    assert diary_due(5, 5, 70, 70 - DIARY_MOOD_SWING).trigger == "mood_swing"
    # 波动不足 / 同日同心情 → 不到时机
    assert not diary_due(5, 5, 70, 70 + DIARY_MOOD_SWING - 1).due
    assert not diary_due(5, 5, 70, 70).due
    assert diary_due(5, 5, 70, 70).trigger == ""


def _make_configured_resident(client: TestClient, tokens: dict, nickname: str = "日记居民") -> tuple[dict, dict]:
    h = auth_headers(tokens)
    cfg = client.post(
        "/api/model-configs",
        json={
            "name": "默认配置", "provider": "custom", "base_url": "http://localhost:8377/v1",
            "api_key": "sk-test", "model": "test-model", "is_default": True,
        },
        headers=h,
    ).json()["id"]
    resident = client.post("/api/residents", json={"nickname": nickname}, headers=h).json()
    client.patch(f"/api/residents/{resident['id']}", json={"model_config_id": cfg}, headers=h)
    return h, resident


def test_write_and_list_diary(client, user_a, mock_adapter):  # noqa: ANN001
    h, resident = _make_configured_resident(client, user_a)
    rid = resident["id"]
    res = client.post(f"/api/residents/{rid}/diary/entries", headers=h)
    assert res.status_code == 201, res.text
    entry = res.json()
    assert entry["trigger"] == "first"
    assert entry["content"]  # mock adapter 有固定内容
    assert 0 <= entry["game_hour"] <= 23
    assert entry["mood"] == 70

    # 同日再次写 → 409（未到时机）
    assert client.post(f"/api/residents/{rid}/diary/entries", headers=h).status_code == 409

    # 列表倒序、属主可见
    lst = client.get(f"/api/residents/{rid}/diary/entries", headers=h).json()
    assert len(lst) == 1 and lst[0]["id"] == entry["id"]

    # 未鉴权 / 越权
    assert client.get(f"/api/residents/{rid}/diary/entries").status_code == 401
    from tests.conftest import register

    other = register(client, "diary-stranger@example.com")
    assert client.get(f"/api/residents/{rid}/diary/entries", headers=auth_headers(other)).status_code == 404


def test_diary_new_day_and_mood_swing(client, user_a, mock_adapter):  # noqa: ANN001
    h, resident = _make_configured_resident(client, user_a)
    rid = resident["id"]
    assert client.post(f"/api/residents/{rid}/diary/entries", headers=h).status_code == 201

    from app.db.models.diary import DiaryEntry
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        # 拨回上一游戏日 → 触发 new_day
        row = db.query(DiaryEntry).filter(DiaryEntry.resident_id == rid).one()
        row.game_day -= 1
        db.commit()
    finally:
        db.close()
    res = client.post(f"/api/residents/{rid}/diary/entries", headers=h)
    assert res.status_code == 201, res.text
    assert res.json()["trigger"] == "new_day"

    # 同日心情波动 → mood_swing（直接改库模拟：全部拨回当前游戏日 + 心情骤降）
    from app.services.world_clock import now_clock

    db = SessionLocal()
    try:
        today = now_clock().day
        rows = db.query(DiaryEntry).filter(DiaryEntry.resident_id == rid).all()
        for r in rows:
            r.game_day = today
        db.commit()
    finally:
        db.close()
    from app.db.models.resident import AIResident

    db = SessionLocal()
    try:
        res_row = db.get(AIResident, rid)
        res_row.mood = 30  # 与写作时 70 相差 40 ≥ 20
        db.commit()
    finally:
        db.close()
    res = client.post(f"/api/residents/{rid}/diary/entries", headers=h)
    assert res.status_code == 201, res.text
    assert res.json()["trigger"] == "mood_swing"


def test_diary_requires_model_config(client, user_a, mock_adapter):  # noqa: ANN001
    h = auth_headers(user_a)
    resident = client.post("/api/residents", json={"nickname": "无配置"}, headers=h).json()
    res = client.post(f"/api/residents/{resident['id']}/diary/entries", headers=h)
    assert res.status_code == 409


def test_resident_delete_cleans_diary(client, user_a, mock_adapter):  # noqa: ANN001
    h, resident = _make_configured_resident(client, user_a)
    rid = resident["id"]
    client.post(f"/api/residents/{rid}/diary/entries", headers=h)
    res = client.request("DELETE", f"/api/residents/{rid}", headers=h)
    assert res.status_code == 204
    from app.db.models.diary import DiaryEntry
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        assert db.query(DiaryEntry).filter(DiaryEntry.resident_id == rid).count() == 0
    finally:
        db.close()
