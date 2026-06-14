"""Admin service - dashboard stats, user list, point transaction ledger"""
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.word import Word
from app.models.wordbook import Wordbook, WordbookWord
from app.models.post import Post
from app.models.point_transaction import PointTransaction


class AdminService:
    """Service for admin dashboard queries"""

    @staticmethod
    def get_stats(db: Session) -> dict:
        """Aggregate counts/sums for the admin dashboard overview"""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)

        total_users = db.scalar(select(sa_func.count()).select_from(User)) or 0
        new_users_today = db.scalar(
            select(sa_func.count()).select_from(User).where(User.created_at >= today_start)
        ) or 0
        new_users_week = db.scalar(
            select(sa_func.count()).select_from(User).where(User.created_at >= week_start)
        ) or 0

        total_wordbooks = db.scalar(select(sa_func.count()).select_from(Wordbook)) or 0
        total_words = db.scalar(select(sa_func.count()).select_from(Word)) or 0
        total_wordbook_words = db.scalar(select(sa_func.count()).select_from(WordbookWord)) or 0

        total_posts_notice = db.scalar(
            select(sa_func.count()).select_from(Post).where(Post.board_type == "notice")
        ) or 0
        total_posts_share = db.scalar(
            select(sa_func.count()).select_from(Post).where(Post.board_type == "share")
        ) or 0

        total_points_awarded = db.scalar(
            select(sa_func.sum(PointTransaction.amount)).where(PointTransaction.amount > 0)
        ) or 0

        points_by_reason: Dict[str, int] = {
            reason: int(total)
            for reason, total in db.execute(
                select(PointTransaction.reason, sa_func.sum(PointTransaction.amount))
                .group_by(PointTransaction.reason)
            ).all()
        }

        words_by_source: Dict[str, int] = {
            source: int(count)
            for source, count in db.execute(
                select(Word.source, sa_func.count()).group_by(Word.source)
            ).all()
        }

        return {
            "total_users": total_users,
            "new_users_today": new_users_today,
            "new_users_week": new_users_week,
            "total_wordbooks": total_wordbooks,
            "total_words": total_words,
            "total_wordbook_words": total_wordbook_words,
            "total_posts_notice": total_posts_notice,
            "total_posts_share": total_posts_share,
            "total_points_awarded": int(total_points_awarded),
            "points_by_reason": points_by_reason,
            "words_by_source": words_by_source,
        }

    @staticmethod
    def list_users(
        db: Session, limit: int = 20, offset: int = 0, search: Optional[str] = None
    ) -> Tuple[List[dict], int]:
        """List users with wordbook/post counts, most recently joined first"""
        stmt = select(User)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                (User.email.ilike(pattern)) | (User.display_name.ilike(pattern))
            )

        total = db.scalar(select(sa_func.count()).select_from(stmt.subquery())) or 0

        stmt = stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
        users = list(db.scalars(stmt).all())

        wordbook_counts: Dict[int, int] = dict(
            db.execute(
                select(Wordbook.user_id, sa_func.count())
                .group_by(Wordbook.user_id)
            ).all()
        )
        post_counts: Dict[int, int] = dict(
            db.execute(
                select(Post.user_id, sa_func.count())
                .group_by(Post.user_id)
            ).all()
        )

        items = [
            {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "points": user.points,
                "is_admin": user.is_admin,
                "is_verified": user.is_verified,
                "created_at": user.created_at,
                "wordbook_count": wordbook_counts.get(user.id, 0),
                "post_count": post_counts.get(user.id, 0),
            }
            for user in users
        ]

        return items, total

    @staticmethod
    def list_point_transactions(
        db: Session,
        limit: int = 20,
        offset: int = 0,
        user_id: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Tuple[List[dict], int, Dict[str, int]]:
        """List point transactions across all users, joined with user info"""
        stmt = select(PointTransaction, User.email, User.display_name).join(
            User, PointTransaction.user_id == User.id
        )
        if user_id is not None:
            stmt = stmt.where(PointTransaction.user_id == user_id)
        if reason is not None:
            stmt = stmt.where(PointTransaction.reason == reason)

        total = db.scalar(select(sa_func.count()).select_from(stmt.subquery())) or 0

        stmt = stmt.order_by(PointTransaction.created_at.desc()).limit(limit).offset(offset)
        rows = db.execute(stmt).all()

        items = [
            {
                "id": txn.id,
                "user_id": txn.user_id,
                "user_email": email,
                "user_display_name": display_name,
                "amount": txn.amount,
                "reason": txn.reason,
                "post_id": txn.post_id,
                "created_at": txn.created_at,
            }
            for txn, email, display_name in rows
        ]

        points_by_reason: Dict[str, int] = {
            r: int(total_amount)
            for r, total_amount in db.execute(
                select(PointTransaction.reason, sa_func.sum(PointTransaction.amount))
                .group_by(PointTransaction.reason)
            ).all()
        }

        return items, total, points_by_reason
