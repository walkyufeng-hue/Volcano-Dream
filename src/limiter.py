import logging
import ipaddress
from typing import Optional, Tuple

from fastapi import HTTPException, Request, status

from .cache import CacheClientFactory
from .config import settings

_logger = logging.getLogger(__name__)


def get_real_ipaddr(request: Request) -> str:
    peer_ip = (
        request.client.host
        if request.client and request.client.host
        else "127.0.0.1"
    )
    if not settings.trust_proxy_headers:
        return peer_ip

    try:
        peer_address = ipaddress.ip_address(peer_ip)
        trusted = any(
            peer_address in ipaddress.ip_network(network, strict=False)
            for network in settings.get_trusted_proxy_networks()
        )
    except ValueError:
        trusted = False

    if not trusted:
        return peer_ip

    forwarded_for = request.headers.get("x-forwarded-for", "")
    candidate = (
        forwarded_for.split(",", 1)[0].strip()
        or request.headers.get("x-real-ip", "").strip()
    )
    try:
        return str(ipaddress.ip_address(candidate)) if candidate else peer_ip
    except ValueError:
        _logger.warning("Ignored invalid forwarded client IP from trusted proxy")
        return peer_ip


def check_rate_limit(
    key: str,
    time_window_seconds: int,
    max_requests: int,
) -> Optional[str]:
    cache_client = CacheClientFactory.get_client()
    return cache_client.check_rate_limit(key, time_window_seconds, max_requests)


def check_global_budget(
    resource: str,
    max_requests: int,
) -> Optional[Tuple[str, str]]:
    if not settings.enable_global_budget:
        return None
    if max_requests <= 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="今日服务额度已用完，请明天再试",
        )

    try:
        key = f"{settings.project_name}:global:{resource}"
        reservation = check_rate_limit(
            key,
            settings.global_budget_window_seconds,
            max_requests,
        )
        return (key, reservation) if reservation else None
    except Exception as exc:
        if (
            isinstance(exc, HTTPException)
            and exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        ):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="今日服务额度已用完，请明天再试",
            ) from exc
        raise


def release_global_budget(
    reservation: Optional[Tuple[str, str]],
) -> None:
    if not reservation:
        return
    key, member = reservation
    CacheClientFactory.get_client().release_rate_limit(key, member)
