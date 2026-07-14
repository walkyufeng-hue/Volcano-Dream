from dataclasses import dataclass
import logging

import httpx


_logger = logging.getLogger(__name__)


class ImageGenerationSkillError(Exception):
    """Internal provider error that is safe to translate at the API boundary."""


@dataclass(frozen=True)
class GeneratedImage:
    encoded_image: str
    media_type: str
    model: str


class DreamImageGenerationSkill:
    name = "image_generation"

    def __init__(
        self,
        api_base: str,
        api_key: str,
        primary_model: str,
        fallback_model: str = "",
    ) -> None:
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.primary_model = primary_model
        self.fallback_model = fallback_model

    @property
    def model_candidates(self) -> tuple[str, ...]:
        models = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models.append(self.fallback_model)
        return tuple(models)

    async def run(self, prompt: str) -> GeneratedImage:
        if not self.api_key:
            raise ImageGenerationSkillError("OpenRouter API Key is missing")

        models = self.model_candidates
        async with httpx.AsyncClient(timeout=120) as client:
            for model_index, model in enumerate(models):
                response = await client.post(
                    f"{self.api_base}/images",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
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
                if response.is_success:
                    try:
                        image_data = response.json()["data"][0]
                        return GeneratedImage(
                            encoded_image=image_data["b64_json"],
                            media_type=image_data.get(
                                "media_type",
                                "image/png",
                            ),
                            model=model,
                        )
                    except (
                        KeyError,
                        IndexError,
                        TypeError,
                        ValueError,
                    ) as exc:
                        raise ImageGenerationSkillError(
                            "Invalid image response from provider"
                        ) from exc

                provider_message = self._get_provider_message(response)
                _logger.error(
                    "Image request rejected: model=%s status=%s message=%s",
                    model,
                    response.status_code,
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

                raise ImageGenerationSkillError(provider_message)

        raise ImageGenerationSkillError("No image model is available")

    @staticmethod
    def _get_provider_message(response: httpx.Response) -> str:
        try:
            error_data = response.json()
            return (
                error_data.get("error", {}).get("message")
                or error_data.get("message")
                or "图片服务拒绝了当前请求"
            )
        except (AttributeError, TypeError, ValueError):
            return "图片服务拒绝了当前请求"
