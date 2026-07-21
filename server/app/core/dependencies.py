"""FastAPI dependencies"""
import secrets
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.services.user_service import UserService

# Bearer token security scheme
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token
    Raises HTTPException if token is invalid or user not found
    """
    token = credentials.credentials

    # Verify token
    user_id = verify_token(token, token_type="access")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from database
    user = UserService.get_by_id(db, int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    UserService.touch_last_active(db, user)

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user (alias for consistency)"""
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require the current user to be an admin"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )
    return current_user


def get_current_real_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Require the current user to be a real (non-guest) account"""
    if current_user.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="회원가입 후 이용할 수 있습니다"
        )
    return current_user


def require_cron_or_admin(
    request: Request,
    db: Session = Depends(get_db),
) -> None:
    """Allow the request if EITHER a valid cron secret header OR an admin JWT is present.

    Auth paths (either one passes):
      1. Header `X-Cron-Secret` matches `settings.CRON_SECRET` (Cloud Scheduler).
         If `settings.CRON_SECRET` is empty/unset, this path ALWAYS fails — an empty
         configured secret must never be satisfiable by an empty (or any) header value.
         Compared with `secrets.compare_digest` to avoid timing-based guessing.
      2. A valid admin Bearer JWT (same verification as `get_current_admin_user`) — used by
         the admin page's "dry-run test" button.

    Raises 401 when neither path is satisfied. Returns None on success (this dependency
    is used only for its side-effect of gating access).
    """
    # --- Path 1: cron secret header ---
    configured = settings.CRON_SECRET or ""
    provided = request.headers.get("X-Cron-Secret")
    if configured and provided is not None and secrets.compare_digest(provided, configured):
        return None

    # --- Path 2: admin JWT (Authorization: Bearer <token>) ---
    auth_header = request.headers.get("Authorization") or ""
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() == "bearer" and token:
        user_id = verify_token(token.strip(), token_type="access")
        if user_id is not None:
            user = UserService.get_by_id(db, int(user_id))
            if user is not None and user.is_active and user.is_admin:
                return None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_nas_tool_key(request: Request) -> None:
    """Allow the request only if a valid NAS-tool API key header is present.

    Auth: header `X-Api-Key` must match `settings.NAS_TOOL_API_KEY`. This gates the local
    video-clipper tool's endpoints — an automated tool, NOT a human/admin API, so there is
    deliberately NO admin-JWT fallback here (unlike require_cron_or_admin).

    If `settings.NAS_TOOL_API_KEY` is empty/unset this path ALWAYS fails — an empty
    configured key must never be satisfiable by an empty (or any) header value. Compared
    with `secrets.compare_digest` to avoid timing-based guessing. Returns None on success.
    """
    configured = settings.NAS_TOOL_API_KEY or ""
    provided = request.headers.get("X-Api-Key")
    if configured and provided is not None and secrets.compare_digest(provided, configured):
        return None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다",
    )
