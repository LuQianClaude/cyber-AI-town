from sqlalchemy import text

from app.db.session import engine


def test_engine_connects() -> None:
    with engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1
