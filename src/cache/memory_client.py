import time
import logging
import threading
import cachetools



from fastapi import HTTPException

from typing import Optional

from .base import CacheClientBase


_logger = logging.getLogger(__name__)


def ttu_func(_key, value, now):
    _, expire_seconds = value
    return now + expire_seconds


class MemoryCacheClient(CacheClientBase):

    _type = "memory"
    token_cache = cachetools.TLRUCache(
        maxsize=5000,
        ttu=ttu_func,
        timer=time.time
    )
    token_lock = threading.RLock()
    rate_lock = threading.RLock()
    # Fix memory leak: use TTLCache instead of defaultdict
    # Keep entries long enough for the anonymous rolling 24-hour limit.
    request_limit_map = cachetools.TTLCache(
        maxsize=10000,
        ttl=24 * 60 * 60 + 60,
        timer=time.time
    )

    @classmethod
    def store_token(cls, key: str, token: str, expire_seconds: int) -> None:
        try:
            with cls.token_lock:
                cls.token_cache[key] = (token, expire_seconds)
            return
        except Exception as e:
            _logger.error(f"Store token failed: {e}")
        raise HTTPException(
            status_code=400, detail="Store token failed"
        )

    @classmethod
    def get_token(cls, key: str) -> Optional[str]:
        try:
            with cls.token_lock:
                if key in cls.token_cache:
                    token, _expire_seconds = cls.token_cache[key]
                    return token
        except Exception as e:
            _logger.error(f"Get token failed: {e}")
            return None

    @classmethod
    def claim_token(cls, key: str, replacement: str, expire_seconds: int) -> Optional[str]:
        try:
            with cls.token_lock:
                if key not in cls.token_cache:
                    return None
                token, _previous_expire = cls.token_cache[key]
                if token in {"processing", "used"}:
                    return None
                cls.token_cache[key] = (replacement, expire_seconds)
                return token
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
        cur_timestamp = time.time()
        member = f"{cur_timestamp}:{time.time_ns()}"
        try:
            with cls.rate_lock:
                if key not in cls.request_limit_map:
                    cls.request_limit_map[key] = []

                history = cls.request_limit_map[key]
                while history and history[0][0] < (cur_timestamp - time_window_seconds):
                    history.pop(0)

                if len(history) >= max_requests:
                    raise HTTPException(
                        status_code=429, detail="Rate limit exceeded"
                    )
                history.append((cur_timestamp, member))
                cls.request_limit_map[key] = history
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
        with cls.rate_lock:
            history = cls.request_limit_map.get(key, [])
            cls.request_limit_map[key] = [
                entry for entry in history if entry[1] != reservation
            ]

    @classmethod
    def get_rate_limit_count(
        cls,
        key: str,
        time_window_seconds: int,
    ) -> int:
        cur_timestamp = time.time()
        with cls.rate_lock:
            history = cls.request_limit_map.get(key, [])
            active_history = [
                entry
                for entry in history
                if entry[0] >= (cur_timestamp - time_window_seconds)
            ]
            if active_history:
                cls.request_limit_map[key] = active_history
            elif key in cls.request_limit_map:
                del cls.request_limit_map[key]
            return len(active_history)
