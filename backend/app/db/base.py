from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """SQLAlchemy 2 声明式基类。所有 ORM 模型在 M2+ 继承本类。"""

    pass
