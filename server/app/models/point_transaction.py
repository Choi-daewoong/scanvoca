"""PointTransaction model - ledger of point awards/deductions"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class PointTransaction(Base):
    """PointTransaction model - records each point award/deduction for a user"""

    __tablename__ = "point_transactions"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Foreign keys
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("posts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Transaction info
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<PointTransaction(user_id={self.user_id}, amount={self.amount}, reason={self.reason})>"
