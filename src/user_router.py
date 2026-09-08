import jwt
import httpx
import datetime
import logging

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.cache import CacheClientFactory
from src.config import settings
from src.limiter import get_real_ipaddr
from src.models import OauthBody, QuotaInfo, SettingsInfo, User
from src.user import get_user

router = APIRouter()
_logger = logging.getLogger(__name__)

GITHUB_URL = "https://github.com/login/oauth/authorize?" \
    f"client_id={settings.github_client_id}" \
    "&scope=user:email"
GITHUB_TOEKN_URL = "https://github.com/login/oauth/access_token" \
    f"?client_id={settings.github_client_id}" \
    f"&client_secret={settings.github_client_secret}"
GITHUB_USER_URL = "https://api.github.com/user"


@router.get("/api/v1/settings", tags=["User"])
async def info(user: Optional[User] = Depends(get_user)):
    return SettingsInfo(
        login_type=user.login_type if user else "",
        user_name=user.user_name if user else "",
        rate_limit=settings.get_human_rate_limit(),
        user_rate_limit=settings.get_human_user_rate_limit(),
        enable_login=bool(settings.github_client_id),
        enable_rate_limit=settings.enable_rate_limit
    )


@router.get("/api/v1/quota", tags=["User"])
async def quota(
    request: Request,
    user: Optional[User] = Depends(get_user),
):
    service_available = True
    if settings.enable_global_budget:
        if settings.global_text_limit <= 0:
            service_available = False
        else:
            try:
                global_used = CacheClientFactory.get_client().get_rate_limit_count(
                    f"{settings.project_name}:global:text",
                    settings.global_budget_window_seconds,
                )
                service_available = global_used < settings.global_text_limit
            except HTTPException:
                # Personal quota can still be displayed when the global counter
                # is temporarily unavailable. Submission remains server-guarded.
                pass

    if not settings.enable_rate_limit:
        return QuotaInfo(
            enabled=False,
            limit=0,
            used=0,
            remaining=0,
            window_seconds=0,
            service_available=service_available,
        )

    if user:
        max_requests, time_window_seconds = settings.user_rate_limit
        key = (
            f"{settings.project_name}:"
            f"{user.login_type}:{user.user_name}"
        )
    else:
        max_requests, time_window_seconds = settings.rate_limit
        key = f"{settings.project_name}:{get_real_ipaddr(request)}"

    used = CacheClientFactory.get_client().get_rate_limit_count(
        key,
        time_window_seconds,
    )
    return QuotaInfo(
        enabled=True,
        limit=max_requests,
        used=used,
        remaining=max(max_requests - used, 0),
        window_seconds=time_window_seconds,
        service_available=service_available,
    )


@router.get("/api/v1/login", tags=["User"])
async def login(login_type: str, redirect_url: str):
    if login_type == "github":
        return f"{GITHUB_URL}&redirect_uri={redirect_url}"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        content="Login type not supported"
    )


@router.post("/api/v1/oauth", tags=["User"])
async def oauth(oauth_body: OauthBody):
    if oauth_body.login_type == "github" and oauth_body.code:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GITHUB_TOEKN_URL}&code={oauth_body.code}",
                headers={"Accept": "application/json"}
            )
            access_token = resp.json()['access_token']
            
            res = await client.get(
                GITHUB_USER_URL,
                headers={
                    "Authorization": f"token {access_token}",
                    "Accept": "application/json"
                }
            )
            user_data = res.json()
            
        user_name = user_data['login']
        return jwt.encode(
            User(
                login_type=oauth_body.login_type,
                user_name=user_name,
                expire_at=(
                    datetime.datetime.now() +
                    datetime.timedelta(days=30)
                ).timestamp(),
            ).model_dump(),
            settings.jwt_secret, algorithm="HS256"
        )
    raise HTTPException(status_code=400, detail="Login type not supported")
