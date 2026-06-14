"""add points to users table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-14 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add points column to users table."""
    op.add_column(
        'users',
        sa.Column('points', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    """Remove points column from users table."""
    op.drop_column('users', 'points')
