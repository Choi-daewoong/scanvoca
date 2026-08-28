"""add landing_path and user_agent to visits table

Revision ID: d6e7f8a9b0c1
Revises: 2c79a8bb7d61
Create Date: 2026-08-28 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, Sequence[str], None] = '2c79a8bb7d61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('visits', sa.Column('landing_path', sa.String(255), nullable=True))
    op.add_column('visits', sa.Column('user_agent', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('visits', 'user_agent')
    op.drop_column('visits', 'landing_path')
