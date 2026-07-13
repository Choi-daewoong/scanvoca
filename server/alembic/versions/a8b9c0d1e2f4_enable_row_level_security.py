"""enable row level security on all tables

Revision ID: a8b9c0d1e2f4
Revises: a7b8c9d0e1f3
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a8b9c0d1e2f4'
down_revision: Union[str, Sequence[str], None] = 'b8c9d0e1f3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable Row Level Security on all public tables."""
    # Enable RLS on all tables
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE words ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE wordbooks ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE wordbook_words ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE posts ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;")

    # Create RLS policies
    # Users table: users can only view/update their own records
    op.execute("""
        CREATE POLICY "users_select_own" ON users
        FOR SELECT USING (auth.uid()::text = id::text);
    """)
    op.execute("""
        CREATE POLICY "users_update_own" ON users
        FOR UPDATE USING (auth.uid()::text = id::text);
    """)

    # Wordbooks: users can only access their own wordbooks
    op.execute("""
        CREATE POLICY "wordbooks_all_own" ON wordbooks
        FOR ALL USING (user_id::text = auth.uid()::text);
    """)

    # Wordbook_words: inherit access from wordbook
    op.execute("""
        CREATE POLICY "wordbook_words_all_own" ON wordbook_words
        FOR ALL USING (EXISTS (
            SELECT 1 FROM wordbooks
            WHERE id = wordbook_words.wordbook_id
            AND user_id::text = auth.uid()::text
        ));
    """)

    # Words: readable by all (AI-generated content)
    op.execute("""
        CREATE POLICY "words_select_all" ON words
        FOR SELECT USING (true);
    """)

    # Posts: users can view all posts, but only create/update their own
    op.execute("""
        CREATE POLICY "posts_select_all" ON posts
        FOR SELECT USING (true);
    """)
    op.execute("""
        CREATE POLICY "posts_create_own" ON posts
        FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);
    """)
    op.execute("""
        CREATE POLICY "posts_update_own" ON posts
        FOR UPDATE USING (user_id::text = auth.uid()::text);
    """)
    op.execute("""
        CREATE POLICY "posts_delete_own" ON posts
        FOR DELETE USING (user_id::text = auth.uid()::text);
    """)

    # Post_likes: users can only manage their own likes
    op.execute("""
        CREATE POLICY "post_likes_all_own" ON post_likes
        FOR ALL USING (user_id::text = auth.uid()::text);
    """)

    # Point_transactions: users can only view their own transactions
    op.execute("""
        CREATE POLICY "point_transactions_select_own" ON point_transactions
        FOR SELECT USING (user_id::text = auth.uid()::text);
    """)


def downgrade() -> None:
    """Disable Row Level Security on all tables (not recommended)."""
    # Drop all policies
    op.execute("DROP POLICY IF EXISTS users_select_own ON users;")
    op.execute("DROP POLICY IF EXISTS users_update_own ON users;")
    op.execute("DROP POLICY IF EXISTS wordbooks_all_own ON wordbooks;")
    op.execute("DROP POLICY IF EXISTS wordbook_words_all_own ON wordbook_words;")
    op.execute("DROP POLICY IF EXISTS words_select_all ON words;")
    op.execute("DROP POLICY IF EXISTS posts_select_all ON posts;")
    op.execute("DROP POLICY IF EXISTS posts_create_own ON posts;")
    op.execute("DROP POLICY IF EXISTS posts_update_own ON posts;")
    op.execute("DROP POLICY IF EXISTS posts_delete_own ON posts;")
    op.execute("DROP POLICY IF EXISTS post_likes_all_own ON post_likes;")
    op.execute("DROP POLICY IF EXISTS point_transactions_select_own ON point_transactions;")

    # Disable RLS
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE words DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE wordbooks DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE wordbook_words DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE posts DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE post_likes DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE point_transactions DISABLE ROW LEVEL SECURITY;")
