import logging

import time
from typing import Optional

from fastapi import HTTPException
import requests

from src.config import settings

from .base import CacheClientBase


_logger = logging.getLogger(__name__)


class UpstashCacheClient(CacheClientBase):

    _type = "upstash"

    @classmethod
    def store_token(cls, key: str, token: str, expire_seconds: int) -> None:
        try:
            res = requests.post(
                f"{settings.upstash_api_url}",
                json=["SET", key, token, "EX", expire_seconds],
                headers={
                    "Authorization": f"Bearer {settings.upstash_api_token}",
                    "Content-Type": "application/json",
                }
            ).json()
            if res.get("result") == "OK":
                return
        except Exception as e:
            _logger.error(f"Store token failed: {e}")
        raise HTTPException(
            status_code=400, detail="Store token failed"
        )

    @classmethod
    def get_token(cls, key: str) -> Optional[str]:
        try:
            res = requests.post(
                f"{settings.upstash_api_url}",
                json=["GET", key],
                headers={
                    "Authorization": f"Bearer {settings.upstash_api_token}",
                    "Content-Type": "application/json",
                }
            )
            if res.status_code != 200:
                _logger.error(f"Get token failed: {res.status_code} {res.text}")
                return None
            return res.json().get("result")
        except Exception as e:
            _logger.error(f"Get token failed: {e}")
        return None

    @classmethod
    def claim_token(cls, key: str, replacement: str, expire_seconds: int) -> Optional[str]:
        script = (
            "local current=redis.call('GET',KEYS[1]);"
            "if not current or current=='processing' or current=='used' then return false end;"
            "redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);return current"
        )
        try:
            response = requests.post(
                settings.upstash_api_url,
                json=["EVAL", script, "1", key, replacement, expire_seconds],
                headers={
                    "Authorization": f"Bearer {settings.upstash_api_token}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            response.raise_for_status()
            result = response.json().get("result")
            return result if isinstance(result, str) else None
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
        member = f"{cur_timestamp}:{time.time_ns()}"
        try:
            res = requests.post(
                f"{settings.upstash_api_url}/multi-exec",
                data="["
                f'["ZREMRANGEBYSCORE", "{key}", "-inf", {cur_timestamp - time_window_seconds}],'
                f'["ZADD", "{key}", {cur_timestamp}, "{member}"],'
                f'["EXPIRE", "{key}", {time_window_seconds}],'
                f'["ZCARD", "{key}"]'
                "]",
                headers={
                    "Authorization": f"Bearer {settings.upstash_api_token}",
                    "Content-Type": "application/json",
                }
            ).json()
            if not all(["result" in r for r in res]) or len(res) != 4:
                raise HTTPException(
                    status_code=400, detail="Can't get rate limit result"
                )
            _, _, _, req_count = res
            if req_count.get("result", 0) > max_requests:
                requests.post(
                    settings.upstash_api_url,
                    json=["ZREM", key, member],
                    headers={
                        "Authorization": f"Bearer {settings.upstash_api_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )
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
            requests.post(
                settings.upstash_api_url,
                json=["ZREM", key, reservation],
                headers={
                    "Authorization": f"Bearer {settings.upstash_api_token}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            ).raise_for_status()
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
            response = requests.post(
                f"{settings.upstash_api_url}/multi-exec",
                json=[
                    [
                        "ZREMRANGEBYSCORE",
                        key,
                        "-inf",
                        cur_timestamp - time_window_seconds,
                    ],
                    ["ZCARD", key],
                ],
                headers={
                    "Authorization": f"Bearer {settings.upstash_api_token}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            response.raise_for_status()
            results = response.json()
            if len(results) != 2 or "result" not in results[1]:
                raise ValueError("Invalid Upstash rate-limit response")
            return int(results[1]["result"] or 0)
        except Exception as e:
            _logger.error("Read rate-limit count failed: %s", e)
            raise HTTPException(
                status_code=400,
                detail="Read rate limit failed",
            ) from e
