"""Redis client for caching"""
import json
from typing import Optional, Any, Union
from redis import Redis, RedisError
from app.core.config import settings

# Redis client instance (optional)
# None means not checked yet, False means checked and failed, Redis instance means connected
redis_client: Union[Redis, bool, None] = None


def get_redis() -> Optional[Redis]:
    """Get Redis client (returns None if Redis is not available)"""
    global redis_client

    # 이미 확인했고 연결 실패한 경우 즉시 None 반환 (타임아웃 방지)
    if redis_client is False:
        return None

    # 이미 연결된 경우 반환
    if isinstance(redis_client, Redis):
        return redis_client

    # 최초 연결 시도
    if redis_client is None:
        try:
            client = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=0.5,  # 1초 → 0.5초로 더 단축
                socket_timeout=0.5
            )
            # Test connection
            client.ping()
            redis_client = client
            print(f"OK: Redis connected: {settings.REDIS_URL}")
            return redis_client
        except (RedisError, Exception) as e:
            print(f"WARNING: Redis not available: {e}")
            print("INFO: Continuing without Redis cache (DB only)")
            redis_client = False  # 실패 표시
            return None

    return None


async def get_cached(key: str) -> Optional[dict]:
    """
    Get cached data from Redis
    Returns None if not found or Redis unavailable
    """
    client = get_redis()
    if client is None:
        return None

    try:
        data = client.get(key)
        if data:
            return json.loads(data)
    except (RedisError, json.JSONDecodeError) as e:
        print(f"Redis get error: {e}")

    return None


async def set_cached(key: str, value: Any, ttl: int = 86400) -> bool:
    """
    Cache data in Redis with TTL (default 24 hours)
    Returns True if successful, False otherwise
    """
    client = get_redis()
    if client is None:
        return False

    try:
        client.setex(key, ttl, json.dumps(value))
        return True
    except (RedisError, TypeError) as e:
        print(f"Redis set error: {e}")
        return False


async def delete_cached(key: str) -> bool:
    """Delete cached data from Redis"""
    client = get_redis()
    if client is None:
        return False

    try:
        client.delete(key)
        return True
    except RedisError as e:
        print(f"Redis delete error: {e}")
        return False
