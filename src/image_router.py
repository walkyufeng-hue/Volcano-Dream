import json
import logging
import secrets

import httpx
from fastapi import APIRouter, HTTPException, status

from src.cache import CacheClientFactory
from src.config import settings
from src.limiter import check_global_budget, release_global_budget
from src.models import DreamImageBody


router = APIRouter()
_logger = logging.getLogger(__name__)
TOKEN_TTL_SECONDS = 10 * 60


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
    return (
        "创作一幅横向16:9的梦幻插画，表现以下梦境中最有象征性的场景。"
        "画面应诗意、神秘、柔和且富有情绪层次，使用电影感构图、细腻光影、"
        "梦雾和富有想象力的色彩。不要出现任何文字、字幕、边框、水印、Logo，"
        "不要表现血腥、恐怖或令人不适的细节。\n\n"
        f"梦境：{dream[:500]}\n\n"
        f"解读线索：{interpretation[:1800]}"
    )


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
