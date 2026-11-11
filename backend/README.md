# Cyber Universe Backend

FastAPI + SQLAlchemy 2 + Pydantic + Alembic。所有权威世界状态与持久化只发生在后端。

## 本地运行

```bash
cd backend
python3 -m pip install --target .deps -r requirements.txt -r requirements-dev.txt
PYTHONPATH=.deps:. python3 -m uvicorn app.main:app --reload --port 8000
```

## 测试

```bash
PYTHONPATH=.deps:. python3 -m pytest tests -v
```

## 数据库迁移

```bash
PYTHONPATH=.deps:. python3 -m alembic revision --autogenerate -m "init"
PYTHONPATH=.deps:. python3 -m alembic upgrade head
```
