"""add qna/faq board support (is_private on posts, post_replies table)

Revision ID: b8c9d0e1f3a4
Revises: a7b8c9d0e1f3
Create Date: 2026-06-15 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f3a4'
down_revision: Union[str, Sequence[str], None] = 'a7b8c9d0e1f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_private to posts and create post_replies table."""
    op.add_column(
        'posts',
        sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        'post_replies',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_post_replies_post_id', 'post_replies', ['post_id'])
    op.create_index('ix_post_replies_user_id', 'post_replies', ['user_id'])


def downgrade() -> None:
    """Drop post_replies table and is_private column."""
    op.drop_index('ix_post_replies_user_id', table_name='post_replies')
    op.drop_index('ix_post_replies_post_id', table_name='post_replies')
    op.drop_table('post_replies')
    op.drop_column('posts', 'is_private')
