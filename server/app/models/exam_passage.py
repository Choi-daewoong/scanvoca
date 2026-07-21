"""ExamPassage model - real 수능/모의고사 English exam passages for the suneung pipeline.

Populated by the one-off ingest script (ingest_exam_pdfs.py), not by the app at runtime.
Each row is one exam question (passage + question + choices). The auto-blog suneung
pipeline picks an unused passage matching a topic's angle, writes an explainer post that
quotes the original passage verbatim, then flips the passage to 'used'.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class ExamPassage(Base):
    """One real exam question (기출 지문). status flips to 'used' once a post cites it."""

    __tablename__ = "exam_passages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Provenance
    year: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 2025
    exam_type: Mapped[str] = mapped_column(String(20), nullable=False)  # '수능' | '모의고사'
    month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 모의고사 시행 월, 수능은 NULL
    problem_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_label: Mapped[str] = mapped_column(String(100), nullable=False)  # "2025학년도 수능 영어"

    # Content
    passage_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    choices: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # 5지선다, 없으면 NULL
    answer: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # 정답, 미상이면 NULL
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # AI가 부여한 문법/소재 키워드

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(10), default="unused", server_default="unused", nullable=False, index=True
    )  # 'unused' | 'used'

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ExamPassage(id={self.id}, {self.source_label}, "
            f"no={self.problem_number}, status={self.status})>"
        )
