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
from app.schemas.wordbook import (
    WordbookBase,
    WordbookCreate,
    WordbookUpdate,
    WordbookResponse,
    WordbookWordBase,
    WordbookWordCreate,
    WordbookWordUpdate,
    WordbookWordResponse,
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
    "WordbookBase",
    "WordbookCreate",
    "WordbookUpdate",
    "WordbookResponse",
    "WordbookWordBase",
    "WordbookWordCreate",
    "WordbookWordUpdate",
    "WordbookWordResponse",
]
