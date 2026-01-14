"""Database session management"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
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
    """Initialize database - create all tables"""
    from app.models.base import Base

    # Import all models to ensure they're registered
    from app.models.user import User  # noqa: F401
    from app.models.word import Word  # noqa: F401
    from app.models.wordbook import Wordbook, WordbookWord  # noqa: F401

    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("[DB] Database tables created successfully")
