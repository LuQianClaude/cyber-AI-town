# © 2026 九尾狐昭昭 · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
"""0005_mailbox_letters

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-11 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'mailbox_letters',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=False),
        sa.Column('resident_id', sa.String(length=36), nullable=False),
        sa.Column('sender_kind', sa.String(length=10), nullable=False),
        sa.Column('sender_resident_id', sa.String(length=36), nullable=True),
        sa.Column('content', sa.String(length=2000), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('reply_to_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resident_id'], ['ai_residents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_resident_id'], ['ai_residents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reply_to_id'], ['mailbox_letters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_mailbox_letters_owner_id'), 'mailbox_letters', ['owner_id'], unique=False)
    op.create_index(op.f('ix_mailbox_letters_resident_id'), 'mailbox_letters', ['resident_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mailbox_letters_resident_id'), table_name='mailbox_letters')
    op.drop_index(op.f('ix_mailbox_letters_owner_id'), table_name='mailbox_letters')
    op.drop_table('mailbox_letters')
