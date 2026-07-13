"""add is_demo to wordbooks table

Revision ID: d1e2f4a5b6c7
Revises: c0d1e2f4a5b6
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = 'c0d1e2f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_demo column to wordbooks table."""
    op.add_column(
        'wordbooks',
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    """Remove is_demo column from wordbooks table."""
    op.drop_column('wordbooks', 'is_demo')
