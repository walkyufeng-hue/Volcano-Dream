from typing import Annotated, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


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
    service_available: bool = True


class OauthBody(BaseModel):
    login_type: str
    code: Optional[str]


class User(BaseModel):
    login_type: str
    user_name: str
    expire_at: float


class DivinationBody(BaseModel):
    prompt: str = Field(min_length=20, max_length=500)
    prompt_type: Literal["dream"]


class DreamSymbol(BaseModel):
    """A symbol grounded in a concrete detail from the submitted dream."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=24)
    meaning: str = Field(min_length=10, max_length=180)
    evidence: str = Field(min_length=1, max_length=100)


DreamMood = Literal[
    "平静", "喜悦", "害怕", "焦虑", "悲伤", "愤怒", "困惑", "孤独",
    "惊讶", "压迫", "期待", "安心", "释然", "怀念", "复杂", "说不清",
]

ShortLabel = Annotated[str, Field(min_length=1, max_length=24)]
SceneLabel = Annotated[str, Field(min_length=1, max_length=40)]
ReflectionQuestion = Annotated[str, Field(min_length=6, max_length=120)]


class DreamAnalysis(BaseModel):
    """Versioned, validated output shared by the API and dream journal."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[3]
    title: str = Field(min_length=2, max_length=24)
    essence: str = Field(min_length=8, max_length=80)
    summary: str = Field(min_length=40, max_length=500)
    moods: list[DreamMood] = Field(min_length=1, max_length=3)
    symbols: list[DreamSymbol] = Field(max_length=4)
    people: list[ShortLabel] = Field(max_length=5)
    scenes: list[SceneLabel] = Field(max_length=5)
    traits: list[
        Literal["清晰", "零碎", "重复出现", "清醒梦", "噩梦", "情节完整"]
    ] = Field(max_length=3)
    psychological_view: str = Field(min_length=80, max_length=900)
    cultural_view: str = Field(min_length=60, max_length=700)
    reflection_questions: list[ReflectionQuestion] = Field(min_length=1, max_length=3)
    image_prompt: str = Field(min_length=30, max_length=250)


class FeedbackBody(BaseModel):
    content: str = Field(min_length=2, max_length=1000)
    contact: str = Field(default="", max_length=100)


class DreamImageBody(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class DreamImageTokenBody(BaseModel):
    dream: str = Field(min_length=20, max_length=500)
    interpretation: str = Field(min_length=1, max_length=5000)
