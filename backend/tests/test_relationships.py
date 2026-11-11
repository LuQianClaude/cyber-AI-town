# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth_headers

BASE = "/api/relationships"


def make_resident(client: TestClient, tokens: dict, nickname: str) -> dict:
    res = client.post(
        "/api/residents",
        json={"nickname": nickname},
        headers=auth_headers(tokens),
    )
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture()
def trio(client, user_a):  # noqa: ANN001
    """user_a 的三个居民：甲、乙、丙。"""
    r1 = make_resident(client, user_a, "甲")
    r2 = make_resident(client, user_a, "乙")
    r3 = make_resident(client, user_a, "丙")
    return {"user": user_a, "甲": r1, "乙": r2, "丙": r3}


def create_rel(client, tokens, a, b, rtype="spouse"):  # noqa: ANN001
    return client.post(
        BASE,
        json={"resident_id": a, "other_resident_id": b, "relation_type": rtype},
        headers=auth_headers(tokens),
    )


def test_create_and_list_relationship(client, trio):  # noqa: ANN001
    h = auth_headers(trio["user"])
    res = create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"])
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["relationship"]["status"] == "pending"
    assert body["relationship"]["relation_type"] == "spouse"
    assert body["other"]["nickname"] == "乙"

    # 双向都能看到
    for rid in (trio["甲"]["id"], trio["乙"]["id"]):
        res = client.get(BASE, params={"resident_id": rid}, headers=h)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["relationship"]["id"] == body["relationship"]["id"]


def test_create_requires_both_owned(client, trio, user_b):  # noqa: ANN001
    stranger = make_resident(client, user_b, "外人")
    res = create_rel(client, trio["user"], trio["甲"]["id"], stranger["id"])
    assert res.status_code == 404
    res = create_rel(client, trio["user"], stranger["id"], trio["甲"]["id"])
    assert res.status_code == 404


def test_create_rejects_self_and_duplicates(client, trio):  # noqa: ANN001
    res = create_rel(client, trio["user"], trio["甲"]["id"], trio["甲"]["id"])
    assert res.status_code == 400

    assert create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"]).status_code == 201
    # 同类型重复（含反向）→ 409
    assert create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"]).status_code == 409
    assert create_rel(client, trio["user"], trio["乙"]["id"], trio["甲"]["id"]).status_code == 409
    # 不同类型允许
    assert create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"], "sworn").status_code == 201


def test_status_transitions(client, trio):  # noqa: ANN001
    h = auth_headers(trio["user"])
    rel = create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"]).json()["relationship"]

    # accepted → accepted 非法；pending → ended 合法
    res = client.patch(f"{BASE}/{rel['id']}", json={"status": "accepted"}, headers=h)
    assert res.status_code == 200
    assert res.json()["relationship"]["status"] == "accepted"

    res = client.patch(f"{BASE}/{rel['id']}", json={"status": "accepted"}, headers=h)
    assert res.status_code == 409

    res = client.patch(f"{BASE}/{rel['id']}", json={"status": "ended"}, headers=h)
    assert res.status_code == 200

    # ended 是终态；解除后同类型可重建
    res = client.patch(f"{BASE}/{rel['id']}", json={"status": "accepted"}, headers=h)
    assert res.status_code == 409
    assert create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"]).status_code == 201


def test_relationship_not_visible_to_others(client, trio, user_b):  # noqa: ANN001
    rel = create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"]).json()["relationship"]
    h_b = auth_headers(user_b)
    assert client.patch(f"{BASE}/{rel['id']}", json={"status": "ended"}, headers=h_b).status_code == 404


def test_family_tree(client, trio):  # noqa: ANN001
    h = auth_headers(trio["user"])
    # 甲-乙 夫妻，乙-丙 结拜，甲-丁(邻居，不入树)
    丁 = make_resident(client, trio["user"], "丁")
    spouse = create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"]).json()["relationship"]
    sworn = create_rel(client, trio["user"], trio["乙"]["id"], trio["丙"]["id"], "sworn").json()["relationship"]
    neighbor = create_rel(client, trio["user"], trio["甲"]["id"], 丁["id"], "neighbor").json()["relationship"]
    for rel in (spouse, sworn, neighbor):
        res = client.patch(f"{BASE}/{rel['id']}", json={"status": "accepted"}, headers=h)
        assert res.status_code == 200

    res = client.get(f"{BASE}/family-tree/{trio['甲']['id']}", headers=h)
    assert res.status_code == 200
    tree = res.json()
    node_ids = {n["id"] for n in tree["nodes"]}
    assert node_ids == {trio["甲"]["id"], trio["乙"]["id"], trio["丙"]["id"]}
    depth_of = {n["id"]: n["depth"] for n in tree["nodes"]}
    assert depth_of[trio["甲"]["id"]] == 0
    assert depth_of[trio["乙"]["id"]] == 1
    assert depth_of[trio["丙"]["id"]] == 2
    types = {e["relation_type"] for e in tree["edges"]}
    assert types == {"spouse", "sworn"}
    assert 丁["id"] not in node_ids

    # pending 的边不入树
    pending_rel = create_rel(client, trio["user"], trio["丙"]["id"], 丁["id"], "sworn").json()["relationship"]
    res = client.get(f"{BASE}/family-tree/{trio['甲']['id']}", headers=h)
    assert 丁["id"] not in {n["id"] for n in res.json()["nodes"]}
    # 确认后入树
    client.patch(f"{BASE}/{pending_rel['id']}", json={"status": "accepted"}, headers=h)
    res = client.get(f"{BASE}/family-tree/{trio['甲']['id']}", headers=h)
    assert 丁["id"] in {n["id"] for n in res.json()["nodes"]}


def test_family_tree_requires_ownership(client, trio, user_b):  # noqa: ANN001
    h_b = auth_headers(user_b)
    res = client.get(f"{BASE}/family-tree/{trio['甲']['id']}", headers=h_b)
    assert res.status_code == 404


def test_deleted_resident_cascades_relationships(client, trio):  # noqa: ANN001
    h = auth_headers(trio["user"])
    create_rel(client, trio["user"], trio["甲"]["id"], trio["乙"]["id"])
    res = client.delete(f"/api/residents/{trio['乙']['id']}", headers=h)
    assert res.status_code == 204
    res = client.get(BASE, params={"resident_id": trio["甲"]["id"]}, headers=h)
    assert res.status_code == 200
    assert res.json() == []


def test_resident_list_unauthenticated(client, trio):  # noqa: ANN001
    res = client.get(BASE, params={"resident_id": trio["甲"]["id"]})
    assert res.status_code == 401
