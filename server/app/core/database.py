"""Database session management"""
from typing import Generator
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

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
    logger.info("Starting database initialization...")

    from app.models.base import Base

    # Import all models to ensure they're registered
    logger.info("Importing models...")
    from app.models.user import User  # noqa: F401
    from app.models.word import Word  # noqa: F401
    from app.models.wordbook import Wordbook, WordbookWord  # noqa: F401

    logger.info("Models imported: User, Word, Wordbook, WordbookWord")

    # Create all tables
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    # List created tables
    tables = Base.metadata.tables.keys()
    logger.info(f"Database tables created: {', '.join(tables)}")
    logger.info("Database initialization completed successfully!")
