"""add problem_type, explanation and passage_group_key to exam_passages

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-08-30 00:00:00.000000

Supports the AI(Gemini)-driven exam-PDF ingestion pipeline replacing the regex parser:

- problem_type: structural discriminator ('standard' | 'underline_choice' |
  'embedded_marker' | 'paragraph_order') that generate_blog_post branches on for how to
  quote passage_text/choices. NOT NULL with server_default='standard' because every one
  of the existing rows was produced by the old regex parser, which only ever emitted the
  'standard' or 'underline_choice' shape — a stale 'standard' tag on an old
  underline_choice row costs nothing downstream, since generate_blog_post's existing
  <u>-span handling is unconditional (not gated on problem_type) and only the two NEW
  branches (embedded_marker/paragraph_order) are type-gated. No data backfill needed.

- explanation: AI-verified Korean reasoning for the answer, produced jointly with the
  passage/question/choices extraction (cross-referencing the answer-key PDF). Nullable:
  old rows have none, and generate_blog_post falls back to its pre-existing "derive
  reasoning from raw passage/choices" behavior whenever this is NULL.

- passage_group_key: observational-only tag linking 장문독해 (shared-passage) rows that
  each carry a full DUPLICATE copy of the same passage_text (no FK/relational concept —
  every row stays independently pairable with its own blog topic, per the existing
  1 passage : 1 topic : 1 post model in get_unused_passage_without_topic /
  get_unused_suneung_topic_with_passage, which is left entirely unchanged).

Column additions only — no new table, so the existing exam_passages RLS is untouched;
new columns inherit the table's row-level security.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'exam_passages',
        sa.Column('problem_type', sa.String(length=30), nullable=False, server_default='standard'),
    )
    op.add_column('exam_passages', sa.Column('explanation', sa.Text(), nullable=True))
    op.add_column(
        'exam_passages', sa.Column('passage_group_key', sa.String(length=60), nullable=True)
    )
    op.create_index(
        op.f('ix_exam_passages_passage_group_key'),
        'exam_passages',
        ['passage_group_key'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_exam_passages_passage_group_key'), table_name='exam_passages')
    op.drop_column('exam_passages', 'passage_group_key')
    op.drop_column('exam_passages', 'explanation')
    op.drop_column('exam_passages', 'problem_type')
