# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""0006_diary_entries

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-11 19:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'diary_entries',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=False),
        sa.Column('resident_id', sa.String(length=36), nullable=False),
        sa.Column('game_day', sa.Integer(), nullable=False),
        sa.Column('game_hour', sa.Integer(), nullable=False),
        sa.Column('mood', sa.Integer(), nullable=False),
        sa.Column('content', sa.String(length=2000), nullable=False),
        sa.Column('trigger', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resident_id'], ['ai_residents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_diary_entries_owner_id'), 'diary_entries', ['owner_id'], unique=False)
    op.create_index(op.f('ix_diary_entries_resident_id'), 'diary_entries', ['resident_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_diary_entries_resident_id'), table_name='diary_entries')
    op.drop_index(op.f('ix_diary_entries_owner_id'), table_name='diary_entries')
    op.drop_table('diary_entries')
