"""create blog_published_posts table

Revision ID: 1e55e5fb9bf9
Revises: ecf64792a4c8
Create Date: 2026-07-15 00:00:00.000000

Lightweight index of every published blog post (title/description/category/tags),
so the AI generator can reference prior posts without re-fetching every markdown
file from GitHub on each generation. Populated unconditionally on every successful
publish, regardless of topic_id (blog_topics only tracks topic-based publishes).

RLS is enabled in this same migration (no policies - internal admin-only data,
same classification as blog_topics) per the 2026-07-15 lesson in
.claude/skills/scanvoca-backend/SKILL.md: new tables must never ship without RLS.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1e55e5fb9bf9'
down_revision: Union[str, Sequence[str], None] = 'ecf64792a4c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create blog_published_posts table and enable RLS (no policies)."""
    op.create_table(
        'blog_published_posts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('slug', sa.String(length=200), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False, server_default=''),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('published_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        op.f('ix_blog_published_posts_slug'), 'blog_published_posts', ['slug'], unique=True
    )
    op.create_index(
        op.f('ix_blog_published_posts_category'), 'blog_published_posts', ['category'], unique=False
    )

    op.execute("ALTER TABLE blog_published_posts ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Drop blog_published_posts table."""
    op.execute("ALTER TABLE blog_published_posts DISABLE ROW LEVEL SECURITY;")
    op.drop_index(op.f('ix_blog_published_posts_category'), table_name='blog_published_posts')
    op.drop_index(op.f('ix_blog_published_posts_slug'), table_name='blog_published_posts')
    op.drop_table('blog_published_posts')
