"""Simple rate limiting for cost-sensitive / abuse-prone endpoints.

Redis 사용 가능하면 INCR+EXPIRE로 정확하게 카운트하고,
Redis가 없으면 프로세스 내 메모리로 best-effort 제한한다.
"""
import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status

from app.core.dependencies import get_current_user
from app.core.redis_client import get_redis
from app.models.user import User

# Redis 미사용 시 fallback: {key: [timestamp, ...]}
_memory_buckets: dict[str, list[float]] = defaultdict(list)


def _check_and_increment(key: str, max_requests: int, window_seconds: int) -> None:
    """Shared bucket check/increment - raises 429 if the limit for `key` is exceeded"""
    client = get_redis()
    if client is not None:
        count = client.incr(key)
        if count == 1:
            client.expire(key, window_seconds)
        if count > max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
            )
    else:
        now = time.time()
        bucket = _memory_buckets[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)
        if len(bucket) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
            )
        bucket.append(now)


class RateLimiter:
    """FastAPI dependency that rate-limits by current user.

    사용 예: Depends(RateLimiter(max_requests=20, window_seconds=3600, scope="ocr_scan"))
    """

    def __init__(self, max_requests: int, window_seconds: int, scope: str):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        key = f"ratelimit:{self.scope}:{current_user.id}"
        _check_and_increment(key, self.max_requests, self.window_seconds)
        return current_user


class IPRateLimiter:
    """FastAPI dependency that rate-limits by client IP (for pre-auth endpoints).

    사용 예: Depends(IPRateLimiter(max_requests=10, window_seconds=3600, scope="guest_bootstrap"))
    """

    def __init__(self, max_requests: int, window_seconds: int, scope: str):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope

    def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{self.scope}:ip:{client_ip}"
        _check_and_increment(key, self.max_requests, self.window_seconds)
