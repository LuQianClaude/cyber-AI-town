# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""0002_resident_relationships

Revision ID: a1b2c3d4e5f6
Revises: 37325182ffe7
Create Date: 2026-11-11 17:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '37325182ffe7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'resident_relationships',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=False),
        sa.Column('resident_id', sa.String(length=36), nullable=False),
        sa.Column('other_resident_id', sa.String(length=36), nullable=False),
        sa.Column('relation_type', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resident_id'], ['ai_residents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['other_resident_id'], ['ai_residents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    # 有效关系（pending/accepted）部分唯一：同一对居民同类型只允许一条；
    # ended 历史不受约束，解除后可重建
    op.create_index(
        'uq_relationship_active_pair_type',
        'resident_relationships',
        ['resident_id', 'other_resident_id', 'relation_type'],
        unique=True,
        sqlite_where=sa.text("status IN ('pending','accepted')"),
    )
    op.create_index(op.f('ix_resident_relationships_owner_id'), 'resident_relationships', ['owner_id'], unique=False)
    op.create_index(op.f('ix_resident_relationships_resident_id'), 'resident_relationships', ['resident_id'], unique=False)
    op.create_index(op.f('ix_resident_relationships_other_resident_id'), 'resident_relationships', ['other_resident_id'], unique=False)


def downgrade() -> None:
    op.drop_index('uq_relationship_active_pair_type', table_name='resident_relationships')
    op.drop_index(op.f('ix_resident_relationships_other_resident_id'), table_name='resident_relationships')
    op.drop_index(op.f('ix_resident_relationships_resident_id'), table_name='resident_relationships')
    op.drop_index(op.f('ix_resident_relationships_owner_id'), table_name='resident_relationships')
    op.drop_table('resident_relationships')
