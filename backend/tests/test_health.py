from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["version"]
    assert body["time"]


def test_root(client: TestClient) -> None:
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["name"] == "Cyber Universe API"
