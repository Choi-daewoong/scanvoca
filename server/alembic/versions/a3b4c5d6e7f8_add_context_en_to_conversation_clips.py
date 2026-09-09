"""add context_en to conversation_clips

Revision ID: a3b4c5d6e7f8
Revises: 596662f9bce2
Create Date: 2026-09-09 00:00:00.000000

The conversation pipeline judges and writes about a clip using ONLY its own short subtitle
window (dialogue_en) — no surrounding scene context was ever captured or stored. Real case
that motivated this: commercial-impact-beyond-views.md described a workplace blame-
deflection line ("if you want to blame someone, just blame yourself") as a witty, humorous
comeback, because nothing in the captured window contradicted that reading — the broader
scene's tension was never available to the model.

context_en stores up to N subtitle lines immediately before/after the clip's window
(local-tools/conversation-clipper's window_context_text), reference-only text never quoted
in a published post and not part of the cut clip video — used only so the topic-discovery
and blog-writing prompts can judge tone/intent correctly.

Column addition only — no new table, so the existing conversation_clips RLS is untouched;
the new column inherits the table's row-level security.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = '596662f9bce2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'conversation_clips', sa.Column('context_en', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('conversation_clips', 'context_en')
