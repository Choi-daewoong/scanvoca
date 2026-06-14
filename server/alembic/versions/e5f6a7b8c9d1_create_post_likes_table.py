"""create post_likes table

Revision ID: e5f6a7b8c9d1
Revises: d4e5f6a7b8c9
Create Date: 2026-06-14 00:00:00.000003

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d1'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create post_likes table."""
    op.create_table(
        'post_likes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('post_id', 'user_id', name='uq_post_likes_post_user'),
    )
    op.create_index('ix_post_likes_post_id', 'post_likes', ['post_id'])
    op.create_index('ix_post_likes_user_id', 'post_likes', ['user_id'])


def downgrade() -> None:
    """Drop post_likes table."""
    op.drop_index('ix_post_likes_user_id', table_name='post_likes')
    op.drop_index('ix_post_likes_post_id', table_name='post_likes')
    op.drop_table('post_likes')
