"""Point service - award points and maintain the point transaction ledger"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func as sa_func
from app.models.user import User
from app.models.point_transaction import PointTransaction


class PointService:
    """Service for point-related database operations"""

    @staticmethod
    def award_points(db: Session, user_id: int, amount: int, reason: str, post_id: Optional[int] = None) -> PointTransaction:
        """Create a PointTransaction and atomically update the user's total points.

        `amount` may be negative (e.g. reversing points when a like is removed).
        The user's total points never drop below 0.
        """
        txn = PointTransaction(user_id=user_id, amount=amount, reason=reason, post_id=post_id)
        db.add(txn)

        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.points = max(0, user.points + amount)

        db.commit()
        db.refresh(txn)
        return txn

    @staticmethod
    def get_history(db: Session, user_id: int, limit: int = 50, offset: int = 0) -> Tuple[List[PointTransaction], int]:
        """Get a user's point transaction history, most recent first"""
        stmt = (
            select(PointTransaction)
            .where(PointTransaction.user_id == user_id)
            .order_by(PointTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        items = list(db.scalars(stmt).all())

        total = db.scalar(
            select(sa_func.count()).select_from(PointTransaction).where(PointTransaction.user_id == user_id)
        ) or 0

        return items, total
