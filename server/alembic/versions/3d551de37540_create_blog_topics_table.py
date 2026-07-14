"""create blog_topics table

Revision ID: 3d551de37540
Revises: a5b6c7d8e9f1
Create Date: 2026-07-14 18:56:13.547435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d551de37540'
down_revision: Union[str, Sequence[str], None] = 'a5b6c7d8e9f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create blog_topics table (marketing-blog topic pool)."""
    op.create_table(
        'blog_topics',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('angle', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False, server_default='unused'),
        sa.Column('post_slug', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_blog_topics_category'), 'blog_topics', ['category'], unique=False)
    op.create_index(op.f('ix_blog_topics_status'), 'blog_topics', ['status'], unique=False)


def downgrade() -> None:
    """Drop blog_topics table."""
    op.drop_index(op.f('ix_blog_topics_status'), table_name='blog_topics')
    op.drop_index(op.f('ix_blog_topics_category'), table_name='blog_topics')
    op.drop_table('blog_topics')
