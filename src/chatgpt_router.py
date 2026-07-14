import json
from typing import Optional
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

import logging

from fastapi import Depends, HTTPException, Request, status


from src.config import settings
from fastapi import APIRouter

from src.models import DivinationBody, User
from src.user import get_user
from src.limiter import (
    check_global_budget,
    check_rate_limit,
    get_real_ipaddr,
    release_global_budget,
)
from src.divination import DivinationFactory
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

    real_ip = get_real_ipaddr(request)
    # rate limit when not login
    if settings.enable_rate_limit:
        if not user:
            max_reqs, time_window_seconds = settings.rate_limit
            try:
                check_rate_limit(
                    f"{settings.project_name}:{real_ip}",
                    time_window_seconds,
                    max_reqs
                )
            except HTTPException as exc:
                if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="今日免费解梦次数已用完，请24小时后再试"
                    ) from exc
                raise
        else:
            max_reqs, time_window_seconds = settings.user_rate_limit
            check_rate_limit(
                f"{settings.project_name}:{user.login_type}:{user.user_name}", time_window_seconds, max_reqs
            )

    _logger.info(
        "Dream request from %s, user=%s, prompt_length=%s",
        real_ip,
        user.user_name if user else None,
        len(divination_body.prompt)
    )
    divination_obj = DivinationFactory.get(divination_body.prompt_type)
    if not divination_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No prompt type {divination_body.prompt_type} not supported"
        )
    prepared = divination_obj.prepare(divination_body)
    prompt = prepared.prompt
    system_prompt = prepared.system_prompt
    risk_level = prepared.metadata.get("risk_level", "normal")
    _logger.info(
        "AI workflow=%s skills=%s risk_level=%s",
        prepared.metadata.get("workflow", "legacy"),
        prepared.metadata.get("skills", []),
        risk_level,
    )

    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="服务暂未配置 OpenRouter API Key"
        )

    budget_reservation = check_global_budget(
        "text",
        settings.global_text_limit,
    )

    try:
        openai_stream = await client.chat.completions.create(
            model=settings.model,
            max_tokens=1000,
            temperature=0.9,
            top_p=1,
            stream=True,
            extra_body={"reasoning": {"effort": "none"}},
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {"role": "user", "content": prompt}
            ]
        )
    except Exception as e:
        release_global_budget(budget_reservation)
        _logger.error("OpenRouter API error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="解梦服务暂时不可用，请稍后重试",
        ) from e

    async def get_openai_generator():
        full_response = ""
        try:
            async for event in openai_stream:
                if event.choices and event.choices[0].delta and event.choices[0].delta.content:
                    current_response = event.choices[0].delta.content
                    full_response += current_response
                    yield f"data: {json.dumps(current_response)}\n\n"
            if full_response and risk_level == "normal":
                image_token = create_image_token(
                    divination_body.prompt,
                    full_response,
                )
                yield (
                    "event: image_token\n"
                    f"data: {json.dumps({'token': image_token})}\n\n"
                )
        except Exception as e:
            _logger.error("Streaming error: %s", e)
            yield (
                "event: FatalError\n"
                f"data: {json.dumps('解梦服务连接中断，请稍后重试')}\n\n"
            )

    return StreamingResponse(get_openai_generator(), media_type='text/event-stream')
