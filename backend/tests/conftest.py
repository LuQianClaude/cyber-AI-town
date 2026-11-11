import os
import sys
import uuid
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# 测试使用独立临时数据库，必须在导入 app 之前设置
os.environ["CYBER_DATABASE_URL"] = f"sqlite:///{Path(__file__).parent}/test.db"
os.environ["CYBER_ENV"] = "testing"
os.environ["CYBER_SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["CYBER_API_KEY_ENCRYPTION_KEY"] = ""

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    # testing 环境下 lifespan 不会自动建表，测试库需显式建表
    from app.db.models import Base
    from app.db.session import engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


def register(client: TestClient, email: str, password: str = "password-123", nickname: str = "测试者") -> dict:
    res = client.post("/api/auth/register", json={"email": email, "password": password, "nickname": nickname})
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture()
def user_a(client: TestClient) -> dict:
    return register(client, f"a-{uuid.uuid4().hex[:8]}@example.com")


@pytest.fixture()
def user_b(client: TestClient) -> dict:
    return register(client, f"b-{uuid.uuid4().hex[:8]}@example.com")


def auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture()
def mock_adapter(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """替换 Provider Adapter，走真实调度路径但返回固定流式内容。"""
    from app.services.providers.base import BaseAdapter

    calls: list[str] = []

    class MockAdapter(BaseAdapter):
        provider = "mock"

        async def stream_chat(self, settings, messages) -> AsyncIterator[str]:  # noqa: ANN001
            calls.extend(m.content for m in messages)
            for piece in ["你好", "，", "我是测试居民"]:
                yield piece

    monkeypatch.setattr("app.services.llm.get_adapter", lambda provider: MockAdapter())
    return calls
