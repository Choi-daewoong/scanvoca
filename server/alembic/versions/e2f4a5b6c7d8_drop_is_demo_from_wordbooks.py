"""drop is_demo from wordbooks table

Revision ID: e2f4a5b6c7d8
Revises: d1e2f4a5b6c7
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2f4a5b6c7d8'
down_revision: Union[str, Sequence[str], None] = 'd1e2f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove is_demo column from wordbooks table (superseded by shadow guest accounts)."""
    op.drop_column('wordbooks', 'is_demo')


def downgrade() -> None:
    """Re-add is_demo column to wordbooks table."""
    op.add_column('wordbooks', sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='false'))
