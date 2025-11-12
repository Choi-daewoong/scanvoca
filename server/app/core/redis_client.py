"""Redis client for caching"""
import json
from typing import Optional, Any
from redis import Redis, RedisError
from app.core.config import settings

# Redis client instance (optional)
redis_client: Optional[Redis] = None


def get_redis() -> Optional[Redis]:
    """Get Redis client (returns None if Redis is not available)"""
    global redis_client

    if redis_client is None:
        try:
            redis_client = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2
            )
            # Test connection
            redis_client.ping()
            print(f"✅ Redis connected: {settings.REDIS_URL}")
        except (RedisError, Exception) as e:
            print(f"⚠️  Redis not available: {e}")
            print("📝 Continuing without Redis cache (DB only)")
            redis_client = None

    return redis_client


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
        print(f"⚠️  Redis get error: {e}")

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
        print(f"⚠️  Redis set error: {e}")
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
        print(f"⚠️  Redis delete error: {e}")
        return False
