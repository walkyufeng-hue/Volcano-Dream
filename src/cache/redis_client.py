import time
from fastapi import HTTPException
import redis
import logging

from typing import Optional

from src.config import settings

from .base import CacheClientBase


_logger = logging.getLogger(__name__)


class RedisCacheClient(CacheClientBase):

    _type = "redis"
    redis_client = None

    @classmethod
    def init_redis(cls):
        if cls.redis_client is None:
            cls.redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

    @classmethod
    def store_token(cls, key: str, token: str, expire_seconds: int) -> None:
        try:
            cls.init_redis()
            cls.redis_client.set(key, token, ex=expire_seconds)
            return
        except Exception as e:
            _logger.error(f"Store token failed: {e}")
        raise HTTPException(
            status_code=400, detail="Store token failed"
        )

    @classmethod
    def get_token(cls, key: str) -> Optional[str]:
        try:
            cls.init_redis()
            return cls.redis_client.get(key)
        except Exception as e:
            _logger.error(f"Get token failed: {e}")
            return None

    @classmethod
    def claim_token(cls, key: str, replacement: str, expire_seconds: int) -> Optional[str]:
        script = """
        local current = redis.call('GET', KEYS[1])
        if not current or current == 'processing' or current == 'used' then
            return false
        end
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        return current
        """
        try:
            cls.init_redis()
            return cls.redis_client.eval(script, 1, key, replacement, expire_seconds)
        except Exception as e:
            _logger.error("Claim token failed: %s", e)
            return None

    @classmethod
    def check_rate_limit(
        cls,
        key: str,
        time_window_seconds: int,
        max_requests: int,
    ) -> Optional[str]:
        cur_timestamp = int(time.time())
        try:
            cls.init_redis()
            member = f"{cur_timestamp}:{time.time_ns()}"
            pipeline = cls.redis_client.pipeline(transaction=True)
            pipeline.zremrangebyscore(key, "-inf", cur_timestamp - time_window_seconds)
            pipeline.zadd(key, {member: cur_timestamp})
            pipeline.expire(key, time_window_seconds)
            pipeline.zcard(key)
            _, _, _, req_count = pipeline.execute()
            if req_count > max_requests:
                cls.redis_client.zrem(key, member)
                raise HTTPException(
                    status_code=429, detail="Rate limit exceeded"
                )
            return member
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            _logger.error(f"Rate limit failed: {e}")
        raise HTTPException(
            status_code=400, detail="Rate limit failed"
        )

    @classmethod
    def release_rate_limit(cls, key: str, reservation: str) -> None:
        try:
            cls.init_redis()
            cls.redis_client.zrem(key, reservation)
        except Exception as e:
            _logger.error("Release rate-limit reservation failed: %s", e)

    @classmethod
    def get_rate_limit_count(
        cls,
        key: str,
        time_window_seconds: int,
    ) -> int:
        cur_timestamp = int(time.time())
        try:
            cls.init_redis()
            pipeline = cls.redis_client.pipeline(transaction=True)
            pipeline.zremrangebyscore(
                key,
                "-inf",
                cur_timestamp - time_window_seconds,
            )
            pipeline.zcard(key)
            _, request_count = pipeline.execute()
            return int(request_count)
        except Exception as e:
            _logger.error("Read rate-limit count failed: %s", e)
            raise HTTPException(
                status_code=400,
                detail="Read rate limit failed",
            ) from e
