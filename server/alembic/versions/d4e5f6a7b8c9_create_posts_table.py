"""create posts table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-14 00:00:00.000002

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create posts table for the community board (notices + wordbook-share posts)."""
    op.create_table(
        'posts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('board_type', sa.String(20), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('wordbook_id', sa.Integer(), sa.ForeignKey('wordbooks.id', ondelete='CASCADE'), nullable=True),
        sa.Column('share_code', sa.String(10), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('like_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('import_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_posts_user_id', 'posts', ['user_id'])
    op.create_index('ix_posts_board_type', 'posts', ['board_type'])
    op.create_index('ix_posts_wordbook_id', 'posts', ['wordbook_id'])
    op.create_index('ix_posts_share_code', 'posts', ['share_code'])
    op.create_index('ix_posts_created_at', 'posts', ['created_at'])


def downgrade() -> None:
    """Drop posts table."""
    op.drop_index('ix_posts_created_at', table_name='posts')
    op.drop_index('ix_posts_share_code', table_name='posts')
    op.drop_index('ix_posts_wordbook_id', table_name='posts')
    op.drop_index('ix_posts_board_type', table_name='posts')
    op.drop_index('ix_posts_user_id', table_name='posts')
    op.drop_table('posts')
