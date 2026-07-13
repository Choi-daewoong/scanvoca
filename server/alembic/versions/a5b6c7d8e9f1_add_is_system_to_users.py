"""add is_system to users table

Revision ID: a5b6c7d8e9f1
Revises: f4a5b6c7d8e9
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5b6c7d8e9f1'
down_revision: Union[str, Sequence[str], None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_system column to users table, and flag the reserved demo owner account."""
    op.add_column('users', sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'))
    op.execute("UPDATE users SET is_system = true WHERE email = 'demo@scanvoca.internal'")


def downgrade() -> None:
    """Remove is_system column from users table."""
    op.drop_column('users', 'is_system')
