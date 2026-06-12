"""Simple per-user rate limiting for cost-sensitive endpoints (Gemini API calls).

Redis 사용 가능하면 INCR+EXPIRE로 정확하게 카운트하고,
Redis가 없으면 프로세스 내 메모리로 best-effort 제한한다.
"""
import time
from collections import defaultdict

from fastapi import Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.core.redis_client import get_redis
from app.models.user import User

# Redis 미사용 시 fallback: {key: [timestamp, ...]}
_memory_buckets: dict[str, list[float]] = defaultdict(list)


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

        client = get_redis()
        if client is not None:
            count = client.incr(key)
            if count == 1:
                client.expire(key, self.window_seconds)
            if count > self.max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
                )
        else:
            now = time.time()
            bucket = _memory_buckets[key]
            cutoff = now - self.window_seconds
            while bucket and bucket[0] < cutoff:
                bucket.pop(0)
            if len(bucket) >= self.max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
                )
            bucket.append(now)

        return current_user
