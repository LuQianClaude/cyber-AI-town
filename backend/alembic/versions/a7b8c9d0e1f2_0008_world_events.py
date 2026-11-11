# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""0008_world_events

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-11 20:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'world_events',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=False),
        sa.Column('kind', sa.String(length=15), nullable=False),
        sa.Column('title', sa.String(length=80), nullable=False),
        sa.Column('content', sa.String(length=500), nullable=False),
        sa.Column('game_day', sa.Integer(), nullable=False),
        sa.Column('game_hour', sa.Integer(), nullable=False),
        sa.Column('resident_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resident_id'], ['ai_residents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_world_events_owner_id'), 'world_events', ['owner_id'], unique=False)
    op.create_index(op.f('ix_world_events_game_day'), 'world_events', ['game_day'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_world_events_game_day'), table_name='world_events')
    op.drop_index(op.f('ix_world_events_owner_id'), table_name='world_events')
    op.drop_table('world_events')
