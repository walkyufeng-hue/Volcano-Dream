import asyncio
import datetime
import os
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config import settings
from src.limiter import check_rate_limit, get_real_ipaddr
from src.models import FeedbackBody, User
from src.user import get_user


router = APIRouter()


def save_feedback(feedback: FeedbackBody, user_name: str) -> None:
    db_path = settings.feedback_db_path
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                contact TEXT NOT NULL DEFAULT '',
                user_name TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            INSERT INTO feedback (content, contact, user_name, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                feedback.content.strip(),
                feedback.contact.strip(),
                user_name,
                datetime.datetime.now(datetime.timezone.utc).isoformat(),
            ),
        )


@router.post("/api/feedback", tags=["Feedback"])
async def create_feedback(
    request: Request,
    feedback: FeedbackBody,
    user: Optional[User] = Depends(get_user),
):
    real_ip = get_real_ipaddr(request)
    try:
        check_rate_limit(
            f"{settings.project_name}:feedback:{real_ip}",
            time_window_seconds=60 * 60,
            max_requests=5,
        )
    except HTTPException as exc:
        if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="反馈提交过于频繁，请稍后再试",
            ) from exc
        raise

    await asyncio.to_thread(
        save_feedback,
        feedback,
        user.user_name if user else "",
    )
    return {"message": "感谢你的反馈，我们会认真查看"}
