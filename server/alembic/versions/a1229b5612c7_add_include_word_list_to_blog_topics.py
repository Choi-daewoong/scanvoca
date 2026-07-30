"""add include_word_list to blog_topics

Revision ID: a1229b5612c7
Revises: a2b3c4d5e6f7
Create Date: 2026-07-30 01:31:15.622839

Adds an opt-in `include_word_list` flag to blog_topics. When true, the toeic auto-publish
run turns the post's core word list into a real Wordbook, shares it on the board, and
inserts a "가져가기" CTA into the published markdown. Existing rows backfill to false via
the server_default, so every current topic behaves exactly as before.

Column addition only — no new table, so the existing blog_topics RLS setup is untouched
(a new column inherits the table's row-level security unchanged).

NOTE: `alembic revision --autogenerate` additionally proposed dropping
ix_point_transactions_user_id_created_at and ix_posts_created_at. Those are pre-existing
drift (both indexes are created by earlier migrations —
f6a7b8c9d0e2 / d4e5f6a7b8c9 — but were never declared on the SQLAlchemy models, so
autogenerate sees them as "removed"). They are unrelated to this change and dropping them
would silently degrade production query performance, so they were removed from this
revision by hand.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1229b5612c7'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add include_word_list column (default false) to blog_topics."""
    op.add_column(
        'blog_topics',
        sa.Column(
            'include_word_list',
            sa.Boolean(),
            nullable=False,
            server_default='false',
        ),
    )


def downgrade() -> None:
    """Drop include_word_list column from blog_topics."""
    op.drop_column('blog_topics', 'include_word_list')
