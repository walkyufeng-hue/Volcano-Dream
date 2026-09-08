from typing import Tuple

from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):

    # project settings
    project_name: str = "volcano-dream"

    # OpenRouter API settings
    api_key: str = Field(default="", exclude=True)
    api_base: str = "https://openrouter.ai/api/v1"
    model: str = "deepseek/deepseek-v4-flash"
    image_model: str = "google/gemini-3.1-flash-image"
    image_fallback_model: str = "recraft/recraft-v4.1"

    # Browser and reverse-proxy security. Comma-separated values are easier to
    # configure consistently across local .env files and hosting platforms.
    allowed_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )
    trust_proxy_headers: bool = False
    trusted_proxy_networks: str = "127.0.0.1/32,::1/128"

    # feedback storage
    feedback_db_path: str = "data/volcano_dream.db"

    # github oauth login settings
    github_client_id: str = ""
    github_client_secret: str = Field(default="", exclude=True)
    jwt_secret: str = Field(default="change-me-before-enabling-login", exclude=True)

    # cache settings
    cache_client_type: str = "memory"
    redis_url: str = Field(default="", exclude=True, alias="KV_URL")
    upstash_api_url: str = Field(default="", alias="KV_REST_API_URL")
    upstash_api_token: str = Field(default="", exclude=True, alias="KV_REST_API_TOKEN")

    # rate limit settings
    # Personal/IP dream quota is open by default. The independent global text
    # and image budgets below remain enabled to protect API spending.
    enable_rate_limit: bool = False
    # These values are retained for environments that explicitly turn the
    # personal/IP quota back on.
    rate_limit: Tuple[int, int] = (5, 24 * 60 * 60)
    user_rate_limit: Tuple[int, int] = (600, 60 * 60)

    # Whole-site circuit breakers. These rolling limits protect the API key
    # even when visitors rotate IP addresses. Set a limit to 0 to disable that
    # particular resource while keeping the service online.
    enable_global_budget: bool = True
    global_text_limit: int = 60
    global_image_limit: int = 20
    global_budget_window_seconds: int = 24 * 60 * 60

    def get_allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]

    def get_trusted_proxy_networks(self) -> list[str]:
        return [
            network.strip()
            for network in self.trusted_proxy_networks.split(",")
            if network.strip()
        ]

    def get_human_rate_limit(self) -> str:
        max_reqs, time_window_seconds = self.rate_limit
        if time_window_seconds == 24 * 60 * 60:
            return f"{max_reqs}次/24小时"
        return f"{max_reqs}req/{time_window_seconds}seconds"

    def get_human_user_rate_limit(self) -> str:
        max_reqs, time_window_seconds = self.user_rate_limit
        # convert to human readable format
        return f"{max_reqs}req/{time_window_seconds}seconds"

    class Config:
        env_file = ".env"


settings = Settings()
