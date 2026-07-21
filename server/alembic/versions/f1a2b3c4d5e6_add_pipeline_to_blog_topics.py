"""add pipeline to blog_topics

Revision ID: f1a2b3c4d5e6
Revises: 1e55e5fb9bf9
Create Date: 2026-07-20 00:00:00.000000

Adds a `pipeline` classifier to blog_topics so the new auto-blog layer can filter
topics by their content pipeline ('manual' = existing hand-run workflow, plus
'toeic' | 'suneung' | 'conversation'). Existing rows backfill to 'manual' via the
server_default, so the manual /admin/blog workflow is unaffected.

Column addition only — no new table, so the existing blog_topics RLS policy is
untouched (a new column inherits the table's row-level security unchanged).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '1e55e5fb9bf9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add pipeline column (default 'manual') + index to blog_topics."""
    op.add_column(
        'blog_topics',
        sa.Column(
            'pipeline',
            sa.String(length=20),
            nullable=False,
            server_default='manual',
        ),
    )
    op.create_index(
        op.f('ix_blog_topics_pipeline'), 'blog_topics', ['pipeline'], unique=False
    )


def downgrade() -> None:
    """Drop pipeline column + index from blog_topics."""
    op.drop_index(op.f('ix_blog_topics_pipeline'), table_name='blog_topics')
    op.drop_column('blog_topics', 'pipeline')
