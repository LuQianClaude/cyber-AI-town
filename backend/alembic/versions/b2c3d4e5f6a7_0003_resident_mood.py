# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""0003_resident_mood

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-11 18:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('ai_residents') as batch_op:
        batch_op.add_column(sa.Column('mood', sa.Integer(), nullable=False, server_default='70'))
        batch_op.add_column(sa.Column('mood_updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade() -> None:
    with op.batch_alter_table('ai_residents') as batch_op:
        batch_op.drop_column('mood_updated_at')
        batch_op.drop_column('mood')
