"""add is_guest and last_active_at to users table

Revision ID: f4a5b6c7d8e9
Revises: e2f4a5b6c7d8
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, Sequence[str], None] = 'e2f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_guest and last_active_at columns to users table."""
    op.add_column('users', sa.Column('is_guest', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('last_active_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Remove is_guest and last_active_at columns from users table."""
    op.drop_column('users', 'last_active_at')
    op.drop_column('users', 'is_guest')
