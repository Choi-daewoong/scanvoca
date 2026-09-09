"""create decks and deck_cards tables

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-09-09 00:00:00.000000

Admin-only personal 영작(EN composition) practice card decks:
  - decks: one pasted Korean/English sentence batch, owned by one admin user.
  - deck_cards: the 1:1 Korean/English sentence pairs, ordered by order_index.

Personal data with NO public read path — the feature lives behind the admin-only
/api/v1/admin/decks router and is scoped to the owning user_id. RLS is enabled in THIS
migration with no policies at all (default-deny for every non-owner role), per the CLAUDE.md
rule that new tables must never ship without RLS. Deliberately NO `FOR SELECT USING (true)`
policy: nothing outside the backend may read these rows. The backend connects as the
`postgres` table owner, which bypasses RLS, so the app itself is unaffected — this only
blocks Supabase anon/authenticated PostgREST access. Same style as
a2b3c4d5e6f7_create_exam_passages_and_conversation_clips.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, Sequence[str], None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create decks + deck_cards and enable RLS (no policies)."""
    op.create_table(
        'decks',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_decks_user_id'), 'decks', ['user_id'], unique=False)

    op.create_table(
        'deck_cards',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('deck_id', sa.Integer(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('korean_text', sa.Text(), nullable=False),
        sa.Column('english_text', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['deck_id'], ['decks.id'], ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_deck_cards_deck_id'), 'deck_cards', ['deck_id'], unique=False)

    # RLS: default-deny for non-owner roles (no policies). Personal, admin-only tables.
    op.execute("ALTER TABLE decks ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Drop deck_cards + decks."""
    op.execute("ALTER TABLE deck_cards DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE decks DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_deck_cards_deck_id'), table_name='deck_cards')
    op.drop_table('deck_cards')

    op.drop_index(op.f('ix_decks_user_id'), table_name='decks')
    op.drop_table('decks')
