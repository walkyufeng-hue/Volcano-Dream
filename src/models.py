from typing import Literal, Optional
from pydantic import BaseModel, Field


class SettingsInfo(BaseModel):
    login_type: str
    user_name: str
    rate_limit: str
    user_rate_limit: str
    enable_login: bool = False
    enable_rate_limit: bool = False


class QuotaInfo(BaseModel):
    enabled: bool
    limit: int
    used: int
    remaining: int
    window_seconds: int


class OauthBody(BaseModel):
    login_type: str
    code: Optional[str]


class User(BaseModel):
    login_type: str
    user_name: str
    expire_at: float


class DivinationBody(BaseModel):
    prompt: str
    prompt_type: Literal["dream"]


class FeedbackBody(BaseModel):
    content: str = Field(min_length=2, max_length=1000)
    contact: str = Field(default="", max_length=100)


class DreamImageBody(BaseModel):
    token: str = Field(min_length=20, max_length=200)
