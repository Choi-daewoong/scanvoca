"""add password_reset_attempts to users table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add password_reset_attempts column to users table."""
    op.add_column(
        'users',
        sa.Column('password_reset_attempts', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    """Remove password_reset_attempts column from users table."""
    op.drop_column('users', 'password_reset_attempts')
