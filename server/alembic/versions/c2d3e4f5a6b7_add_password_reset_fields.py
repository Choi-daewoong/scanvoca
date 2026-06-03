"""add password reset fields to users table

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-03-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add password_reset_token and password_reset_expires_at columns to users table."""
    op.add_column('users', sa.Column('password_reset_token', sa.String(6), nullable=True))
    op.add_column('users', sa.Column('password_reset_expires_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Remove password reset columns from users table."""
    op.drop_column('users', 'password_reset_expires_at')
    op.drop_column('users', 'password_reset_token')
