"""add updated_at to words table

Revision ID: b1c2d3e4f5a6
Revises: 93f70c4a6a8d
Create Date: 2026-01-26 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = '93f70c4a6a8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add updated_at column to words table."""
    # Add updated_at column with default value
    op.add_column('words', sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()))

    # Update existing rows to set updated_at = created_at
    op.execute("UPDATE words SET updated_at = created_at WHERE updated_at IS NULL")

    # Make the column non-nullable after setting values
    op.alter_column('words', 'updated_at', nullable=False)


def downgrade() -> None:
    """Remove updated_at column from words table."""
    op.drop_column('words', 'updated_at')
