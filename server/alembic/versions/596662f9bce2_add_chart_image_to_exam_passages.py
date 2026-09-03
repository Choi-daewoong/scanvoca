"""add chart_image to exam_passages

Revision ID: 596662f9bce2
Revises: e7f8a9b0c1d2
Create Date: 2026-09-04 00:00:00.000000

Adds a 'chart' problem_type (validated at the application layer, not a DB enum — see
app.schemas.exam_extraction.ProblemType) and a place to store the actual cropped chart
image for it.

Real incident that motivated this: the AI extraction pipeline classified a 도표(chart)
problem as 'standard' (no dedicated type existed), so passage_text held only the printed
caption sentence ("The graph above shows...") with no way to reproduce the chart itself.
generate_blog_post then had nothing to quote and invented plausible-looking percentages in
the answer explanation that didn't match the real chart (2026 수능 영어 25번, published
2026-09-03, corrected by hand the same week). chart_image lets ingest_exam_pdfs.py store
the real cropped PNG so the publish step can embed the actual image instead of a
text description, and lets a future extraction prompt ground its explanation in the
real image rather than free-writing numbers.

Column addition only — no new table, so the existing exam_passages RLS is untouched; the
new column inherits the table's row-level security.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '596662f9bce2'
down_revision: Union[str, Sequence[str], None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'exam_passages', sa.Column('chart_image', sa.LargeBinary(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('exam_passages', 'chart_image')
