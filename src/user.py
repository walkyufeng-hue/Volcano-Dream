import datetime
import logging
from typing import Optional

import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.config import settings
from src.models import User

_logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)
DEFAULT_TOKEN = ["xxx", "undefined"]


def get_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    if not credentials or credentials.credentials in DEFAULT_TOKEN:
        return None

    try:
        jwt_token = credentials.credentials
        payload = jwt.decode(
            jwt_token, settings.jwt_secret, algorithms=["HS256"])
        jwt_payload = User.model_validate(payload)
        if jwt_payload.expire_at < datetime.datetime.now().timestamp():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        return jwt_payload
    except HTTPException:
        raise
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        if settings.github_client_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="登录状态无效，请重新登录",
            ) from exc
        return None
