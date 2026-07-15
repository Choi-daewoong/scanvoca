"""enable row level security on alembic_version table

Revision ID: ecf64792a4c8
Revises: 0a4429712614
Create Date: 2026-07-15 00:05:00.000000

alembic_version holds no sensitive data (just the current migration revision
id) but sits in the public schema like any app table, so Supabase's security
advisor flags it too. Locking it down completes the RLS cleanup; the backend
(postgres role, table owner) is unaffected.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'ecf64792a4c8'
down_revision: Union[str, Sequence[str], None] = '0a4429712614'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    op.execute("ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY;")
