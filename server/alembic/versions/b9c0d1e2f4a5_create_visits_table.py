"""create visits table

Revision ID: b9c0d1e2f4a5
Revises: a8b9c0d1e2f4
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9c0d1e2f4a5'
down_revision: Union[str, Sequence[str], None] = 'a8b9c0d1e2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create visits table."""
    op.create_table(
        'visits',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('visitor_id', sa.String(64), nullable=False),
        sa.Column('visit_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('visitor_id', 'visit_date', name='uq_visits_visitor_date'),
    )
    op.create_index('ix_visits_visitor_id', 'visits', ['visitor_id'])
    op.create_index('ix_visits_visit_date', 'visits', ['visit_date'])


def downgrade() -> None:
    """Drop visits table."""
    op.drop_index('ix_visits_visit_date', table_name='visits')
    op.drop_index('ix_visits_visitor_id', table_name='visits')
    op.drop_table('visits')
