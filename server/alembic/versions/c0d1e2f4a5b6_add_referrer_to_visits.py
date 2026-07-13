"""add referrer to visits table

Revision ID: c0d1e2f4a5b6
Revises: b9c0d1e2f4a5
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0d1e2f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'b9c0d1e2f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add referrer column to visits table."""
    op.add_column('visits', sa.Column('referrer', sa.String(255), nullable=True))


def downgrade() -> None:
    """Remove referrer column from visits table."""
    op.drop_column('visits', 'referrer')
