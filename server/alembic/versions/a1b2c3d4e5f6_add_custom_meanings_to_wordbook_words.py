"""add custom_meanings to wordbook_words table

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add custom_meanings column to wordbook_words table."""
    op.add_column(
        'wordbook_words',
        sa.Column('custom_meanings', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    """Remove custom_meanings column from wordbook_words table."""
    op.drop_column('wordbook_words', 'custom_meanings')
