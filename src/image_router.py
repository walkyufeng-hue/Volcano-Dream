import json
import logging
import secrets

import httpx
from fastapi import APIRouter, HTTPException, status

from src.cache import CacheClientFactory
from src.config import settings
from src.limiter import check_global_budget, release_global_budget
from src.models import DreamImageBody
from src.skills import (
    DreamImageGenerationSkill,
    DreamImagePromptSkill,
    ImageGenerationSkillError,
)


router = APIRouter()
_logger = logging.getLogger(__name__)
TOKEN_TTL_SECONDS = 10 * 60
IMAGE_PROMPT_SKILL = DreamImagePromptSkill()
IMAGE_GENERATION_SKILL = DreamImageGenerationSkill(
    api_base=settings.api_base,
    api_key=settings.api_key,
    primary_model=settings.image_model,
    fallback_model=settings.image_fallback_model,
)


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
    return IMAGE_PROMPT_SKILL.run(dream, interpretation)


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

    try:
        generated_image = await IMAGE_GENERATION_SKILL.run(prompt)
    except HTTPException:
        cache_client.store_token(key, cached_payload, TOKEN_TTL_SECONDS)
        release_global_budget(budget_reservation)
        raise
    except (ImageGenerationSkillError, httpx.HTTPError) as exc:
        cache_client.store_token(key, cached_payload, TOKEN_TTL_SECONDS)
        release_global_budget(budget_reservation)
        _logger.error("OpenRouter image generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="梦境配图生成失败，请稍后重试",
        ) from exc

    cache_client.store_token(key, "used", TOKEN_TTL_SECONDS)
    return {
        "image": (
            f"data:{generated_image.media_type};base64,"
            f"{generated_image.encoded_image}"
        ),
        "model": generated_image.model,
    }
