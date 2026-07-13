"""Visit model - anonymous daily visitor tracking for admin analytics"""
from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import String, Date, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Visit(Base):
    """One row per (visitor_id, visit_date) - dedupes a visitor to one count per day"""

    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    visitor_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    visit_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # Referring hostname the visitor arrived from that day (e.g. "google.com", "direct")
    referrer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint('visitor_id', 'visit_date', name='uq_visits_visitor_date'),
    )

    def __repr__(self) -> str:
        return f"<Visit(visitor_id={self.visitor_id}, visit_date={self.visit_date})>"
