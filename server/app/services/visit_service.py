"""Visit service - records anonymous daily visits, aggregates for admin analytics"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func as sa_func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models.visit import Visit


class VisitService:
    """Service for recording and aggregating site visits"""

    @staticmethod
    def record_visit(db: Session, visitor_id: str) -> None:
        """Record a visit for today. Idempotent per (visitor_id, day) via unique constraint."""
        today = datetime.now(timezone.utc).date()
        db.add(Visit(visitor_id=visitor_id, visit_date=today))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    @staticmethod
    def get_stats(db: Session) -> dict:
        """Today / last-7-days / last-30-days unique visitor counts, plus a 30-day daily trend"""
        today = datetime.now(timezone.utc).date()
        week_start = today - timedelta(days=6)
        month_start = today - timedelta(days=29)

        today_count = db.scalar(
            select(sa_func.count()).select_from(Visit).where(Visit.visit_date == today)
        ) or 0
        week_count = db.scalar(
            select(sa_func.count(sa_func.distinct(Visit.visitor_id)))
            .where(Visit.visit_date >= week_start)
        ) or 0
        month_count = db.scalar(
            select(sa_func.count(sa_func.distinct(Visit.visitor_id)))
            .where(Visit.visit_date >= month_start)
        ) or 0

        daily_rows = db.execute(
            select(Visit.visit_date, sa_func.count())
            .where(Visit.visit_date >= month_start)
            .group_by(Visit.visit_date)
            .order_by(Visit.visit_date)
        ).all()
        daily = [{"date": d.isoformat(), "count": c} for d, c in daily_rows]

        return {
            "today": today_count,
            "week": week_count,
            "month": month_count,
            "daily": daily,
        }
