"""add content_format to posts

Revision ID: a7b8c9d0e1f3
Revises: f6a7b8c9d0e2
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f3'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add content_format column to posts table."""
    op.add_column(
        'posts',
        sa.Column('content_format', sa.String(10), nullable=False, server_default='plain'),
    )


def downgrade() -> None:
    """Remove content_format column from posts table."""
    op.drop_column('posts', 'content_format')
