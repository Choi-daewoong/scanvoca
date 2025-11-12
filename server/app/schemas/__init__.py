"""API schemas"""
from app.schemas.user import (
    UserBase,
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    TokenPayload,
)
from app.schemas.word import (
    WordMeaning,
    WordResponse,
    WordGenerateRequest,
    WordGenerateResult,
    WordGenerateResponse,
)

__all__ = [
    "UserBase",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "TokenResponse",
    "TokenPayload",
    "WordMeaning",
    "WordResponse",
    "WordGenerateRequest",
    "WordGenerateResult",
    "WordGenerateResponse",
]
