"""add share_code to wordbooks table

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add share_code column to wordbooks table."""
    op.add_column('wordbooks', sa.Column('share_code', sa.String(10), nullable=True))
    op.create_index('ix_wordbooks_share_code', 'wordbooks', ['share_code'], unique=True)


def downgrade() -> None:
    """Remove share_code column from wordbooks table."""
    op.drop_index('ix_wordbooks_share_code', table_name='wordbooks')
    op.drop_column('wordbooks', 'share_code')
