"""Database session management"""
from typing import Generator
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Create engine with appropriate settings for SQLite or PostgreSQL
if "sqlite" in settings.DATABASE_URL:
    # SQLite 설정
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )
else:
    # PostgreSQL 설정 (Supabase 등)
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,      # 연결 유효성 검사
        pool_recycle=3600,       # 1시간마다 연결 재활용
        pool_size=5,             # 기본 연결 풀 크기
        max_overflow=10,         # 추가 허용 연결 수
        echo=settings.DEBUG,
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Get database session dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database - create all tables (SQLite only).

    Production (Postgres/Supabase) schema is managed exclusively by Alembic migrations —
    this used to run create_all unconditionally on every startup, which on Cloud Run means
    every cold start (min-instances is 0) paid for a full table-introspection round trip to
    Supabase before the container could accept its first request, directly adding to the
    "first visit takes forever" load time. It has also previously created real tables in
    production without their RLS policies the moment a new model was merely imported
    (see CLAUDE.md's 2026-07-21 changelog entry) — create_all only remains useful for the
    disposable SQLite databases tests and local dev bootstrap from scratch.
    """
    logger.info("Starting database initialization...")

    from app.models.base import Base

    # Import all models to ensure they're registered
    logger.info("Importing models...")
    from app.models.user import User  # noqa: F401
    from app.models.word import Word  # noqa: F401
    from app.models.wordbook import Wordbook, WordbookWord  # noqa: F401

    logger.info("Models imported: User, Word, Wordbook, WordbookWord")

    if "sqlite" not in settings.DATABASE_URL:
        logger.info("Postgres detected — schema is managed by Alembic, skipping create_all")
        return

    # Create all tables
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    # List created tables
    tables = Base.metadata.tables.keys()
    logger.info(f"Database tables created: {', '.join(tables)}")
    logger.info("Database initialization completed successfully!")
