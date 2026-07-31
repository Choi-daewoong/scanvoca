"""add topic_id to exam_passages

Revision ID: 2c79a8bb7d61
Revises: a1229b5612c7
Create Date: 2026-07-31 13:23:14.951743

Pairs an exam passage 1:1 with the blog topic that was derived FROM it (passage-first
suneung pipeline). Nullable + unique: passages are ingested in bulk long before any topic
exists, so every existing row backfills to NULL, which correctly reads as "no topic derived
from this passage yet" — no data backfill is needed.

ondelete='SET NULL' (NOT cascade): exam passages are scarce, hard-won ingested content.
Deleting a blog topic must only unpair its passage so it can be reused, never delete it.

Column addition only — no new table, so the existing exam_passages RLS setup (enabled in
a2b3c4d5e6f7) is untouched; a new column inherits the table's row-level security unchanged.

The autogenerate diff for this revision contained exactly these three operations (added
column + added unique index + added foreign key) and nothing else; only the FK constraint
name was filled in by hand, because alembic emits `None` there and `op.drop_constraint(None,
...)` in downgrade() cannot resolve a name at runtime.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c79a8bb7d61'
down_revision: Union[str, Sequence[str], None] = 'a1229b5612c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_NAME = "fk_exam_passages_topic_id_blog_topics"


def upgrade() -> None:
    """Add the nullable, unique, indexed topic_id FK to exam_passages."""
    op.add_column('exam_passages', sa.Column('topic_id', sa.Integer(), nullable=True))
    op.create_index(
        op.f('ix_exam_passages_topic_id'), 'exam_passages', ['topic_id'], unique=True
    )
    op.create_foreign_key(
        FK_NAME, 'exam_passages', 'blog_topics', ['topic_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    """Drop topic_id (and its index/FK) from exam_passages."""
    op.drop_constraint(FK_NAME, 'exam_passages', type_='foreignkey')
    op.drop_index(op.f('ix_exam_passages_topic_id'), table_name='exam_passages')
    op.drop_column('exam_passages', 'topic_id')
