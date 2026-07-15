"""enable row level security on tables added after the original RLS migration

Revision ID: 0a4429712614
Revises: 3d551de37540
Create Date: 2026-07-15 00:00:00.000000

Supabase's security advisor flagged blog_topics, post_replies, and visits as
publicly accessible: they were created after a8b9c0d1e2f4 (2026-06-26) enabled
RLS on the original 7 tables, so they were never covered. The backend connects
as the `postgres` role (table owner), which bypasses RLS by default, so this
only blocks direct access via Supabase's anon/authenticated PostgREST roles -
the app itself is unaffected.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '0a4429712614'
down_revision: Union[str, Sequence[str], None] = '3d551de37540'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable RLS on tables that postdate the original security migration."""
    op.execute("ALTER TABLE blog_topics ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE post_replies ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE visits ENABLE ROW LEVEL SECURITY;")

    # blog_topics: internal admin-only content-marketing data, no end-user or
    # public read/write path exists in the app - deny all non-owner access.
    # (no policies created - RLS enabled with zero grants is a default-deny)

    # post_replies: admin answers to Q&A posts. Mirrors the "posts" table
    # policy style from a8b9c0d1e2f4 - publicly readable (answers are meant
    # to be seen), writes restricted to the authoring user.
    op.execute("""
        CREATE POLICY "post_replies_select_all" ON post_replies
        FOR SELECT USING (true);
    """)
    op.execute("""
        CREATE POLICY "post_replies_write_own" ON post_replies
        FOR ALL USING (user_id::text = auth.uid()::text);
    """)

    # visits: analytics/traffic tracking, admin-dashboard only - deny all
    # non-owner access (no policies created).


def downgrade() -> None:
    """Disable RLS on these tables (not recommended)."""
    op.execute("DROP POLICY IF EXISTS post_replies_select_all ON post_replies;")
    op.execute("DROP POLICY IF EXISTS post_replies_write_own ON post_replies;")

    op.execute("ALTER TABLE blog_topics DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE post_replies DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE visits DISABLE ROW LEVEL SECURITY;")
