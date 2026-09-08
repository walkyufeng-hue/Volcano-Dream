import json
from typing import Optional
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

import logging

from fastapi import Depends, HTTPException, Request, status


from src.config import settings
from fastapi import APIRouter

from pydantic import ValidationError

from src.models import DivinationBody, DreamAnalysis, User
from src.user import get_user
from src.limiter import (
    check_global_budget,
    check_rate_limit,
    get_real_ipaddr,
    release_global_budget,
    release_rate_limit,
)
from src.divination import DivinationFactory
from src.divination.dream import dream_analysis_to_markdown
from src.image_router import create_image_token

client = AsyncOpenAI(
    api_key=settings.api_key,
    base_url=settings.api_base,
    default_headers={"X-OpenRouter-Title": "Volcano Dream AI"},
)
router = APIRouter()
_logger = logging.getLogger(__name__)
@router.post("/api/divination")
async def divination(
        request: Request,
        divination_body: DivinationBody,
        user: Optional[User] = Depends(get_user)
):

    divination_obj = DivinationFactory.get(divination_body.prompt_type)
    if not divination_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No prompt type {divination_body.prompt_type} not supported"
        )
    prompt, system_prompt = divination_obj.build_prompt(divination_body)

    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="服务暂未配置 OpenRouter API Key"
        )

    real_ip = get_real_ipaddr(request)
    rate_limit_reservation = None
    if settings.enable_rate_limit:
        if not user:
            max_reqs, time_window_seconds = settings.rate_limit
            quota_key = f"{settings.project_name}:{real_ip}"
        else:
            max_reqs, time_window_seconds = settings.user_rate_limit
            quota_key = (
                f"{settings.project_name}:"
                f"{user.login_type}:{user.user_name}"
            )

        try:
            reservation = check_rate_limit(
                quota_key,
                time_window_seconds,
                max_reqs,
            )
            if reservation:
                rate_limit_reservation = (quota_key, reservation)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="今日免费解梦次数已用完，请24小时后再试"
                ) from exc
            raise

    _logger.info(
        "Dream request from %s, user=%s, prompt_length=%s",
        real_ip,
        user.user_name if user else None,
        len(divination_body.prompt)
    )

    try:
        budget_reservation = check_global_budget(
            "text",
            settings.global_text_limit,
        )
    except Exception:
        if rate_limit_reservation:
            release_rate_limit(*rate_limit_reservation)
        raise

    async def get_openai_generator():
        completed = False
        raw_analysis = ""
        finish_reason = None
        try:
            yield (
                "event: phase\n"
                f"data: {json.dumps({'message': '正在整理梦里的情绪与意象'}, ensure_ascii=False)}\n\n"
            )

            openai_stream = await client.chat.completions.create(
                model=settings.model,
                max_tokens=3000,
                temperature=0.7,
                top_p=1,
                stream=True,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "dream_analysis",
                        "strict": True,
                        "schema": DreamAnalysis.model_json_schema(),
                    },
                },
                extra_body={
                    "reasoning": {"effort": "none"},
                    "provider": {"require_parameters": True},
                },
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {"role": "user", "content": prompt}
                ]
            )

            async for event in openai_stream:
                if not event.choices:
                    continue
                choice = event.choices[0]
                if choice.finish_reason:
                    finish_reason = choice.finish_reason
                if choice.delta and choice.delta.content:
                    raw_analysis += choice.delta.content

            if not raw_analysis.strip():
                raise ValueError("provider returned an empty analysis")
            if finish_reason == "length":
                raise ValueError("provider truncated the structured analysis")

            analysis = DreamAnalysis.model_validate_json(raw_analysis)
            completed = True
            analysis_payload = analysis.model_dump(mode="json")
            yield (
                "event: analysis\n"
                f"data: {json.dumps(analysis_payload, ensure_ascii=False)}\n\n"
            )

            legacy_result = dream_analysis_to_markdown(analysis)
            yield (
                "event: legacy_result\n"
                f"data: {json.dumps(legacy_result, ensure_ascii=False)}\n\n"
            )

            try:
                image_token = create_image_token(
                    divination_body.prompt,
                    analysis.image_prompt,
                )
                yield (
                    "event: image_token\n"
                    f"data: {json.dumps({'token': image_token})}\n\n"
                )
            except Exception as image_token_error:
                _logger.error("Failed to create image token: %s", image_token_error)
                yield (
                    "event: image_error\n"
                    "data: "
                    f"{json.dumps('解读已完成，但暂时无法创建梦境画面', ensure_ascii=False)}"
                    "\n\n"
                )
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            if isinstance(e, (ValidationError, ValueError)):
                _logger.error("Structured output validation failed: %s", e)
                public_error = "解梦结果格式异常，请稍后重试"
            else:
                _logger.error("Streaming error: %s", e)
                public_error = "解梦服务连接中断，请稍后重试"
            yield (
                "event: FatalError\n"
                f"data: {json.dumps(public_error, ensure_ascii=False)}\n\n"
            )
        finally:
            if not completed:
                release_global_budget(budget_reservation)
                if rate_limit_reservation:
                    release_rate_limit(*rate_limit_reservation)

    return StreamingResponse(
        get_openai_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
