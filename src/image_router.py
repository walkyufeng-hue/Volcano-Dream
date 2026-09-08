import json
import logging
import secrets

import httpx
from fastapi import APIRouter, HTTPException, Request, status

from src.cache import CacheClientFactory
from src.config import settings
from src.limiter import (
    check_global_budget,
    check_rate_limit,
    get_real_ipaddr,
    release_global_budget,
    release_rate_limit,
)
from src.models import DreamImageBody, DreamImageTokenBody


router = APIRouter()
_logger = logging.getLogger(__name__)
TOKEN_TTL_SECONDS = 10 * 60
IMAGE_RETRY_TOKEN_LIMIT = 3
IMAGE_RETRY_TOKEN_WINDOW_SECONDS = 24 * 60 * 60


def _cache_key(token: str) -> str:
    return f"{settings.project_name}:dream-image:{token}"


def create_image_token(dream: str, interpretation: str) -> str:
    token = secrets.token_urlsafe(32)
    payload = json.dumps(
        {
            "dream": dream.strip(),
            "interpretation": interpretation.strip(),
        },
        ensure_ascii=False,
    )
    CacheClientFactory.get_client().store_token(
        _cache_key(token),
        payload,
        TOKEN_TTL_SECONDS,
    )
    return token


def build_image_prompt(dream: str, interpretation: str) -> str:
    dream_content = dream.strip()[:500]
    interpretation_clues = interpretation.strip()[:700]
    return (
        "请创作一幅横向16:9的梦幻叙事插画。\n\n"
        "【画面事实｜最高优先级】\n"
        f"{dream_content}\n\n"
        "必须忠实呈现上面梦境中真实出现的人物、地点、物体和动作。"
        "不要因为下方解读而添加梦境里没有出现的主要人物、地点、事件或道具；"
        "遇到没有说明的细节时保持克制，用光影、雾气或留白表达，不要擅自编造。\n\n"
        "【情绪与象征参考｜仅用于视觉气氛】\n"
        f"{interpretation_clues}\n\n"
        "解读内容只能影响色彩、光线、天气、空间感和情绪张力，"
        "不要把心理分析、行动建议、未来推测或抽象文字直接画进画面。\n\n"
        "【构图要求】\n"
        "只生成一幅完整连续的单一场景，以梦境中最有辨识度的主体作为唯一视觉焦点。"
        "使用电影感横向构图、自然景深、细腻光影和克制的梦雾；"
        "整体诗意、神秘、柔和，但保留梦境本身的具体细节和情绪。"
        "禁止拼贴、分屏、网格、漫画格、画中画、前后对比和多个互不相连的场景。\n\n"
        "【排除内容】\n"
        "不要出现任何文字、字幕、标牌、边框、水印、Logo或界面元素；"
        "不要表现血腥、猎奇、过度恐怖或令人不适的细节。"
    )


@router.post("/api/dream-image/token", tags=["Dream Image"])
async def refresh_dream_image_token(body: DreamImageTokenBody, request: Request):
    """Issue a short-lived image token for a locally saved dream."""
    dream = body.dream.strip()
    interpretation = body.interpretation.strip()
    if len(dream) < 20 or not interpretation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="梦境记录不完整，无法重新生成配图",
        )
    retry_key = (
        f"{settings.project_name}:image-retry-token:"
        f"{get_real_ipaddr(request)}"
    )
    try:
        retry_reservation = check_rate_limit(
            retry_key,
            IMAGE_RETRY_TOKEN_WINDOW_SECONDS,
            IMAGE_RETRY_TOKEN_LIMIT,
        )
    except HTTPException as exc:
        if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="今天的配图重试次数已用完，请明天再试",
            ) from exc
        raise

    try:
        token = create_image_token(dream, interpretation)
    except Exception:
        if retry_reservation:
            release_rate_limit(retry_key, retry_reservation)
        raise

    return {"token": token}


@router.post("/api/dream-image", tags=["Dream Image"])
async def generate_dream_image(body: DreamImageBody):
    cache_client = CacheClientFactory.get_client()
    key = _cache_key(body.token)
    cached_payload = cache_client.claim_token(key, "processing", 60)

    if not cached_payload:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="配图凭证已失效，请重新解梦",
        )

    try:
        payload = json.loads(cached_payload)
        prompt = build_image_prompt(
            payload.get("dream", ""),
            payload.get("interpretation", ""),
        )
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="配图凭证格式错误",
        ) from exc

    try:
        budget_reservation = check_global_budget(
            "image",
            settings.global_image_limit,
        )
    except HTTPException:
        cache_client.store_token(key, cached_payload, TOKEN_TTL_SECONDS)
        raise

    used_model = settings.image_model
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            models = [settings.image_model]
            if (
                settings.image_fallback_model
                and settings.image_fallback_model != settings.image_model
            ):
                models.append(settings.image_fallback_model)

            response = None
            for model_index, model in enumerate(models):
                candidate_response = await client.post(
                    f"{settings.api_base.rstrip('/')}/images",
                    headers={
                        "Authorization": f"Bearer {settings.api_key}",
                        "Content-Type": "application/json",
                        "X-OpenRouter-Title": "Volcano Dream AI",
                    },
                    json={
                        "model": model,
                        "prompt": prompt,
                        "n": 1,
                        "resolution": "1K",
                        "aspect_ratio": "16:9",
                    },
                )
                if candidate_response.is_success:
                    response = candidate_response
                    used_model = model
                    break

                try:
                    error_data = candidate_response.json()
                    provider_message = (
                        error_data.get("error", {}).get("message")
                        or error_data.get("message")
                        or "图片服务拒绝了当前请求"
                    )
                except (TypeError, ValueError):
                    provider_message = "图片服务拒绝了当前请求"

                _logger.error(
                    "OpenRouter image request rejected: model=%s, status=%s, "
                    "message=%s",
                    model,
                    candidate_response.status_code,
                    provider_message[:500],
                )

                location_restricted = (
                    "location is not supported" in provider_message.lower()
                )
                has_fallback = model_index < len(models) - 1
                if location_restricted and has_fallback:
                    _logger.warning(
                        "Image model %s is region restricted; trying %s",
                        model,
                        models[model_index + 1],
                    )
                    continue

                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="梦境配图生成失败，请稍后重试",
                )

            if response is None:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="梦境配图生成失败，请稍后重试",
                )

            response_data = response.json()
            image_data = response_data["data"][0]
            encoded_image = image_data["b64_json"]
            media_type = image_data.get("media_type", "image/png")
    except HTTPException:
        cache_client.store_token(key, cached_payload, TOKEN_TTL_SECONDS)
        release_global_budget(budget_reservation)
        raise
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        cache_client.store_token(key, cached_payload, TOKEN_TTL_SECONDS)
        release_global_budget(budget_reservation)
        _logger.error("OpenRouter image generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="梦境配图生成失败，请稍后重试",
        ) from exc

    cache_client.store_token(key, "used", TOKEN_TTL_SECONDS)
    return {
        "image": f"data:{media_type};base64,{encoded_image}",
        "model": used_model,
    }
