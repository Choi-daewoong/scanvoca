"""create point_transactions table

Revision ID: f6a7b8c9d0e2
Revises: e5f6a7b8c9d1
Create Date: 2026-06-14 00:00:00.000004

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e2'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create point_transactions table."""
    op.create_table(
        'point_transactions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_point_transactions_user_id', 'point_transactions', ['user_id'])
    op.create_index('ix_point_transactions_post_id', 'point_transactions', ['post_id'])
    op.create_index('ix_point_transactions_user_id_created_at', 'point_transactions', ['user_id', 'created_at'])


def downgrade() -> None:
    """Drop point_transactions table."""
    op.drop_index('ix_point_transactions_user_id_created_at', table_name='point_transactions')
    op.drop_index('ix_point_transactions_post_id', table_name='point_transactions')
    op.drop_index('ix_point_transactions_user_id', table_name='point_transactions')
    op.drop_table('point_transactions')
