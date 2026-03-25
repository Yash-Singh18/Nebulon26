import redis
from config import REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, MEMORY_TTL, MAX_MEMORY_QUERIES

_redis = None


async def init_redis():
    global _redis
    if REDIS_URL:
        print(f"Connecting to Redis via URL")
        _redis = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    else:
        print(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}")
        _redis = redis.Redis(
            host=REDIS_HOST, port=REDIS_PORT,
            password=REDIS_PASSWORD or None,
            decode_responses=True,
        )
    _redis.ping()
    print("Redis connected")


def store_query(session_id: str, query: str):
    key = f"session:{session_id}:queries"
    _redis.lpush(key, query)
    _redis.ltrim(key, 0, MAX_MEMORY_QUERIES - 1)
    _redis.expire(key, MEMORY_TTL)


def get_recent_queries(session_id: str) -> list[str]:
    key = f"session:{session_id}:queries"
    return _redis.lrange(key, 0, MAX_MEMORY_QUERIES - 1) or []


def set_business_type(session_id: str, business_type: str):
    key = f"session:{session_id}:business_type"
    _redis.set(key, business_type, ex=MEMORY_TTL)


def get_business_type(session_id: str) -> str:
    key = f"session:{session_id}:business_type"
    return _redis.get(key) or ""


def set_language(session_id: str, language: str):
    key = f"session:{session_id}:language"
    _redis.set(key, language, ex=MEMORY_TTL)


def get_language(session_id: str) -> str:
    key = f"session:{session_id}:language"
    return _redis.get(key) or "en"
