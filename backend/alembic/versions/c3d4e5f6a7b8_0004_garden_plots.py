# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""0004_garden_plots

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-11 18:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'garden_plots',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=False),
        sa.Column('plot_index', sa.Integer(), nullable=False),
        sa.Column('crop', sa.String(length=20), nullable=True),
        sa.Column('planted_tick', sa.Integer(), nullable=True),
        sa.Column('harvests', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('owner_id', 'plot_index', name='uq_garden_plot_owner_index'),
    )
    op.create_index(op.f('ix_garden_plots_owner_id'), 'garden_plots', ['owner_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_garden_plots_owner_id'), table_name='garden_plots')
    op.drop_table('garden_plots')
