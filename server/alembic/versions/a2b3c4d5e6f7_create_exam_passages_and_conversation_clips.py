"""create exam_passages and conversation_clips tables

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-07-20 12:00:00.000000

Phase-2 auto-blog tables:
  - exam_passages: real 수능/모의고사 English questions (suneung pipeline source).
  - conversation_clips: cut video clips + dialogue, 1:1 with a conversation topic.

Both are backend-internal (no public/anon read path exists in the app — published blog
content lives in GitHub markdown, not these tables). RLS is enabled in THIS migration with
no policies (default-deny for every non-owner role), per the CLAUDE.md rule that new tables
must never ship without RLS. The backend connects as the `postgres` table owner, which
bypasses RLS, so the app is unaffected — this only blocks Supabase anon/authenticated
PostgREST access. Same classification/style as blog_topics & blog_published_posts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create exam_passages + conversation_clips and enable RLS (no policies)."""
    op.create_table(
        'exam_passages',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('exam_type', sa.String(length=20), nullable=False),
        sa.Column('month', sa.Integer(), nullable=True),
        sa.Column('problem_number', sa.Integer(), nullable=False),
        sa.Column('source_label', sa.String(length=100), nullable=False),
        sa.Column('passage_text', sa.Text(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('choices', sa.JSON(), nullable=True),
        sa.Column('answer', sa.String(length=10), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=10), nullable=False, server_default='unused'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        op.f('ix_exam_passages_status'), 'exam_passages', ['status'], unique=False
    )

    op.create_table(
        'conversation_clips',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('topic_id', sa.Integer(), nullable=False),
        sa.Column('video_title', sa.String(length=200), nullable=False),
        sa.Column('dialogue_en', sa.Text(), nullable=False),
        sa.Column('dialogue_ko', sa.Text(), nullable=True),
        sa.Column('start_seconds', sa.Float(), nullable=False),
        sa.Column('end_seconds', sa.Float(), nullable=False),
        sa.Column('clip_url', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['topic_id'], ['blog_topics.id'], ondelete='CASCADE'),
    )
    op.create_index(
        op.f('ix_conversation_clips_topic_id'),
        'conversation_clips',
        ['topic_id'],
        unique=True,
    )
    op.create_index(
        op.f('ix_conversation_clips_status'), 'conversation_clips', ['status'], unique=False
    )

    # RLS: default-deny for non-owner roles (no policies). Internal-only tables.
    op.execute("ALTER TABLE exam_passages ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE conversation_clips ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Drop conversation_clips + exam_passages."""
    op.execute("ALTER TABLE conversation_clips DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE exam_passages DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_conversation_clips_status'), table_name='conversation_clips')
    op.drop_index(op.f('ix_conversation_clips_topic_id'), table_name='conversation_clips')
    op.drop_table('conversation_clips')

    op.drop_index(op.f('ix_exam_passages_status'), table_name='exam_passages')
    op.drop_table('exam_passages')
