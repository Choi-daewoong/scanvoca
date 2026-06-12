"""add folder/order fields to wordbooks table

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add parent_id, sort_order, is_folder columns to wordbooks table."""
    op.add_column('wordbooks', sa.Column('parent_id', sa.Integer(), nullable=True))
    op.add_column('wordbooks', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('wordbooks', sa.Column('is_folder', sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_index('ix_wordbooks_parent_id', 'wordbooks', ['parent_id'])
    op.create_foreign_key(
        'fk_wordbooks_parent_id_wordbooks',
        'wordbooks', 'wordbooks',
        ['parent_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Remove parent_id, sort_order, is_folder columns from wordbooks table."""
    op.drop_constraint('fk_wordbooks_parent_id_wordbooks', 'wordbooks', type_='foreignkey')
    op.drop_index('ix_wordbooks_parent_id', table_name='wordbooks')
    op.drop_column('wordbooks', 'is_folder')
    op.drop_column('wordbooks', 'sort_order')
    op.drop_column('wordbooks', 'parent_id')
