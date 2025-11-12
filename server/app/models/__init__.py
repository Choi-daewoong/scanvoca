"""Database models"""
from app.models.base import Base
from app.models.user import User
from app.models.word import Word

__all__ = ["Base", "User", "Word"]
