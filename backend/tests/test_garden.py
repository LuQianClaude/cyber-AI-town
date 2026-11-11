# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import pytest
from fastapi.testclient import TestClient

from app.services.garden import CROPS, PLOT_COUNT, plot_stage
from tests.conftest import auth_headers, register

BASE = "/api/garden"


@pytest.fixture()
def garden_user(client, user_a):  # noqa: ANN001
    return user_a


def test_plot_stage_math() -> None:
    assert plot_stage(None, None, 1000) == {"stage": "empty", "progress": 0.0, "remaining_minutes": None}
    grow = CROPS["radish"].grow_minutes  # 90 游戏分钟
    s = plot_stage("radish", 1000, 1000)
    assert s["stage"] == "growing" and s["progress"] == 0.0 and s["remaining_minutes"] == grow
    s = plot_stage("radish", 1000, 1000 + grow // 2)
    assert s["stage"] == "growing" and s["progress"] == 0.5
    s = plot_stage("radish", 1000, 1000 + grow)
    assert s["stage"] == "mature" and s["progress"] == 1.0 and s["remaining_minutes"] == 0
    # 成熟度不随时间倒退
    assert plot_stage("radish", 1000, 1000 + grow * 10)["stage"] == "mature"


def test_garden_lazy_init_and_isolation(client, garden_user, user_b):  # noqa: ANN001
    h = auth_headers(garden_user)
    res = client.get(BASE, headers=h)
    assert res.status_code == 200
    plots = res.json()
    assert len(plots) == PLOT_COUNT
    assert [p["index"] for p in plots] == list(range(PLOT_COUNT))
    assert all(p["stage"] == "empty" for p in plots)

    # 属主隔离：user_b 的地独立
    res_b = client.get(BASE, headers=auth_headers(user_b))
    assert len(res_b.json()) == PLOT_COUNT
    client.post(f"{BASE}/plots/0/plant", json={"crop": "radish"}, headers=h)
    assert client.get(BASE, headers=auth_headers(user_b)).json()[0]["stage"] == "empty"


def test_plant_rules(client, garden_user):  # noqa: ANN001
    h = auth_headers(garden_user)
    # 非法作物 / 非法地块
    assert client.post(f"{BASE}/plots/0/plant", json={"crop": "pumpkin"}, headers=h).status_code == 400
    assert client.post(f"{BASE}/plots/99/plant", json={"crop": "radish"}, headers=h).status_code == 400
    assert client.post(f"{BASE}/plots/-1/plant", json={"crop": "radish"}, headers=h).status_code == 400
    # 正常播种
    res = client.post(f"{BASE}/plots/2/plant", json={"crop": "tomato"}, headers=h)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["stage"] == "growing" and body["crop_name"] == "小番茄"
    assert body["progress"] < 1 and body["remaining_minutes"] > 0
    # 重复播种冲突
    assert client.post(f"{BASE}/plots/2/plant", json={"crop": "radish"}, headers=h).status_code == 409
    # 未鉴权
    assert client.post(f"{BASE}/plots/3/plant", json={"crop": "radish"}).status_code == 401


def test_harvest_requires_maturity(client, garden_user):  # noqa: ANN001
    h = auth_headers(garden_user)
    client.post(f"{BASE}/plots/1/plant", json={"crop": "radish"}, headers=h)
    assert client.post(f"{BASE}/plots/1/harvest", headers=h).status_code == 409  # 未成熟
    # 直接改库把种植时刻拨到成熟前
    from app.db.models.garden import GardenPlot
    from app.db.session import SessionLocal
    from app.services.world_clock import now_clock

    me = client.get("/api/auth/me", headers=h).json()
    db = SessionLocal()
    try:
        row = (
            db.query(GardenPlot)
            .filter(GardenPlot.owner_id == me["id"], GardenPlot.plot_index == 1)
            .one()
        )
        row.planted_tick = now_clock().tick - CROPS["radish"].grow_minutes
        db.commit()
    finally:
        db.close()
    res = client.post(f"{BASE}/plots/1/harvest", headers=h)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["stage"] == "empty" and body["harvests"] == 1
    # 空地不能再收
    assert client.post(f"{BASE}/plots/1/harvest", headers=h).status_code == 409


def test_clear_resets_without_harvest(client, garden_user):  # noqa: ANN001
    h = auth_headers(garden_user)
    client.post(f"{BASE}/plots/4/plant", json={"crop": "sunflower"}, headers=h)
    res = client.post(f"{BASE}/plots/4/clear", headers=h)
    assert res.status_code == 200
    body = res.json()
    assert body["stage"] == "empty" and body["harvests"] == 0
    # 空地再清除幂等
    assert client.post(f"{BASE}/plots/4/clear", headers=h).status_code == 200


def test_account_delete_cascades_plots(client, garden_user):  # noqa: ANN001
    h = auth_headers(garden_user)
    client.get(BASE, headers=h)
    me = client.get("/api/auth/me", headers=h).json()["id"]
    res = client.request("DELETE", "/api/auth/me", json={"password": "password-123"}, headers=h)
    assert res.status_code == 204
    from app.db.models.garden import GardenPlot
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        assert db.query(GardenPlot).filter(GardenPlot.owner_id == me).count() == 0
    finally:
        db.close()
