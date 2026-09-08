import unittest
import uuid
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import Request

from src.app import app
from src.cache.memory_client import MemoryCacheClient
from src.config import settings
from src.limiter import get_real_ipaddr
from src.models import DivinationBody
from src.image_router import (
    IMAGE_RETRY_TOKEN_LIMIT,
    IMAGE_RETRY_TOKEN_WINDOW_SECONDS,
)


class FakeOpenAIStream:
    def __init__(self, chunks: list[str], finish_reason: str = "stop") -> None:
        self.events = [
            SimpleNamespace(
                choices=[SimpleNamespace(
                    delta=SimpleNamespace(content=chunk),
                    finish_reason=None,
                )]
            )
            for chunk in chunks
        ]
        self.events.append(
            SimpleNamespace(
                choices=[SimpleNamespace(
                    delta=SimpleNamespace(content=None),
                    finish_reason=finish_reason,
                )]
            )
        )
        self.index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.index >= len(self.events):
            raise StopAsyncIteration
        event = self.events[self.index]
        self.index += 1
        return event


def make_analysis_json() -> str:
    return json.dumps({
        "schema_version": 3,
        "title": "穿过雨夜",
        "essence": "你在模糊的雨夜里继续前行，也在寻找一处可以安心停下的地方。",
        "summary": "你独自穿过一条安静的雨夜街道，既有焦虑，也在寻找可以停留的地方。雨水让周围变得模糊，而你始终没有停止向前。",
        "moods": ["焦虑", "期待"],
        "symbols": [{
            "name": "雨夜",
            "meaning": "雨夜可能承载尚未完全说清的压力，也可能代表一种缓慢整理情绪的过程。",
            "evidence": "独自走在下雨的街道",
        }],
        "people": ["自己"],
        "scenes": ["雨夜街道"],
        "traits": ["清晰"],
        "psychological_view": (
            "这段梦最突出的并不是危险，而是一边前行、一边寻找落脚点的感觉。"
            "它可能对应某种仍在进行中的选择，让你既想继续，也希望获得一点确定感。\n\n"
            "雨夜把外界变得模糊，也让注意力回到自己的脚步。你也许正在整理一些无法立刻说清的情绪，"
            "但梦里的持续前行说明你没有停在原地。"
        ),
        "cultural_view": (
            "从传统文化的象征联想来看，雨常与洗涤、变化和情绪流动有关，"
            "夜路则可能让人想到尚未看清方向的阶段。\n\n"
            "这些意象没有固定的吉凶含义，也不代表对未来的预测；"
            "它们只是帮助你从另一个角度回看梦里的感受。"
        ),
        "reflection_questions": ["你在梦里寻找的是一个具体地点，还是一种可以安心停下来的感觉？"],
        "image_prompt": "雨夜的安静街道上，一个人缓慢向前走，远处有可以停留的微光，画面克制而安静。",
    }, ensure_ascii=False)


def make_request(peer_ip: str, headers: dict[str, str]) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [
                (key.lower().encode(), value.encode())
                for key, value in headers.items()
            ],
            "client": (peer_ip, 1234),
            "server": ("test", 80),
            "scheme": "http",
            "query_string": b"",
            "root_path": "",
            "http_version": "1.1",
        }
    )


class SecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_trust_proxy_headers = settings.trust_proxy_headers
        self.original_trusted_proxy_networks = settings.trusted_proxy_networks

    def tearDown(self) -> None:
        settings.trust_proxy_headers = self.original_trust_proxy_headers
        settings.trusted_proxy_networks = self.original_trusted_proxy_networks

    def test_untrusted_ip_headers_are_ignored(self) -> None:
        settings.trust_proxy_headers = False
        request = make_request("203.0.113.10", {"x-real-ip": "1.2.3.4"})
        self.assertEqual(get_real_ipaddr(request), "203.0.113.10")

    def test_trusted_proxy_can_forward_client_ip(self) -> None:
        settings.trust_proxy_headers = True
        settings.trusted_proxy_networks = "127.0.0.1/32"
        request = make_request(
            "127.0.0.1",
            {"x-forwarded-for": "198.51.100.8"},
        )
        self.assertEqual(get_real_ipaddr(request), "198.51.100.8")

    def test_one_time_token_is_claimed_once(self) -> None:
        key = f"test:token:{uuid.uuid4()}"
        MemoryCacheClient.store_token(key, "payload", 30)
        self.assertEqual(
            MemoryCacheClient.claim_token(key, "processing", 30),
            "payload",
        )
        self.assertIsNone(MemoryCacheClient.claim_token(key, "processing", 30))

    def test_rejected_request_does_not_extend_limit(self) -> None:
        key = f"test:limit:{uuid.uuid4()}"
        MemoryCacheClient.check_rate_limit(key, 60, 2)
        MemoryCacheClient.check_rate_limit(key, 60, 2)
        with self.assertRaises(HTTPException) as context:
            MemoryCacheClient.check_rate_limit(key, 60, 2)
        self.assertEqual(context.exception.status_code, 429)
        self.assertEqual(len(MemoryCacheClient.request_limit_map[key]), 2)

    def test_failed_request_can_release_global_reservation(self) -> None:
        key = f"test:reservation:{uuid.uuid4()}"
        reservation = MemoryCacheClient.check_rate_limit(key, 60, 2)
        self.assertIsNotNone(reservation)
        MemoryCacheClient.release_rate_limit(key, reservation or "")
        self.assertEqual(len(MemoryCacheClient.request_limit_map[key]), 0)

    def test_rate_limit_count_tracks_active_requests(self) -> None:
        key = f"test:count:{uuid.uuid4()}"
        self.assertEqual(MemoryCacheClient.get_rate_limit_count(key, 60), 0)
        MemoryCacheClient.check_rate_limit(key, 60, 3)
        MemoryCacheClient.check_rate_limit(key, 60, 3)
        self.assertEqual(MemoryCacheClient.get_rate_limit_count(key, 60), 2)

    def test_health_endpoint(self) -> None:
        response = TestClient(app).get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), "ok")

    def test_personal_dream_quota_is_open_by_default(self) -> None:
        self.assertFalse(settings.enable_rate_limit)
        response = TestClient(app).get(
            "/api/v1/quota",
            headers={"Authorization": "Bearer xxx"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["enabled"])

    def test_quota_stays_available_after_first_anonymous_dream(self) -> None:
        original_rate_limit_enabled = settings.enable_rate_limit
        original_rate_limit = settings.rate_limit
        quota_key = f"{settings.project_name}:testclient"
        MemoryCacheClient.request_limit_map.pop(quota_key, None)
        settings.enable_rate_limit = True
        settings.rate_limit = (5, 24 * 60 * 60)
        try:
            MemoryCacheClient.check_rate_limit(
                quota_key,
                settings.rate_limit[1],
                settings.rate_limit[0],
            )
            response = TestClient(app).get(
                "/api/v1/quota",
                headers={"Authorization": "Bearer xxx"},
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["used"], 1)
            self.assertEqual(response.json()["remaining"], 4)
        finally:
            settings.enable_rate_limit = original_rate_limit_enabled
            settings.rate_limit = original_rate_limit
            MemoryCacheClient.request_limit_map.pop(quota_key, None)

    def test_dream_requires_twenty_characters(self) -> None:
        with self.assertRaises(ValidationError):
            DivinationBody(prompt="太短了", prompt_type="dream")

        body = DivinationBody(prompt="梦" * 20, prompt_type="dream")
        self.assertEqual(len(body.prompt), 20)

    def test_failed_provider_request_refunds_personal_quota(self) -> None:
        original_api_key = settings.api_key
        original_global_budget = settings.enable_global_budget
        original_rate_limit_enabled = settings.enable_rate_limit
        original_rate_limit = settings.rate_limit
        quota_key = f"{settings.project_name}:testclient"
        MemoryCacheClient.request_limit_map.pop(quota_key, None)
        settings.api_key = "test-key"
        settings.enable_global_budget = False
        settings.enable_rate_limit = True
        settings.rate_limit = (1, 60)
        try:
            with patch(
                "src.chatgpt_router.client.chat.completions.create",
                new=AsyncMock(side_effect=RuntimeError("provider unavailable")),
            ):
                response = TestClient(app).post(
                    "/api/divination",
                    json={"prompt": "梦" * 20, "prompt_type": "dream"},
                    headers={"Authorization": "Bearer xxx"},
                )
            self.assertEqual(response.status_code, 200)
            self.assertIn("event: FatalError", response.text)
            self.assertEqual(
                MemoryCacheClient.get_rate_limit_count(quota_key, 60),
                0,
            )
        finally:
            settings.api_key = original_api_key
            settings.enable_global_budget = original_global_budget
            settings.enable_rate_limit = original_rate_limit_enabled
            settings.rate_limit = original_rate_limit
            MemoryCacheClient.request_limit_map.pop(quota_key, None)

    def test_structured_dream_events_are_emitted_in_order(self) -> None:
        original_api_key = settings.api_key
        original_global_budget = settings.enable_global_budget
        original_rate_limit = settings.rate_limit
        quota_key = f"{settings.project_name}:testclient"
        MemoryCacheClient.request_limit_map.pop(quota_key, None)
        settings.api_key = "test-key"
        settings.enable_global_budget = False
        settings.rate_limit = (2, 60)
        create_mock = AsyncMock(return_value=FakeOpenAIStream([make_analysis_json()]))
        try:
            with patch(
                "src.chatgpt_router.client.chat.completions.create",
                new=create_mock,
            ), patch(
                "src.chatgpt_router.create_image_token",
                return_value="image-token-for-test-123456789",
            ):
                response = TestClient(app).post(
                    "/api/divination",
                    json={"prompt": "梦" * 20, "prompt_type": "dream"},
                    headers={"Authorization": "Bearer xxx"},
                )

            self.assertEqual(response.status_code, 200)
            events = [
                "event: phase",
                "event: analysis",
                "event: legacy_result",
                "event: image_token",
                "event: done",
            ]
            positions = [response.text.index(event) for event in events]
            self.assertEqual(positions, sorted(positions))
            self.assertNotIn("event: FatalError", response.text)

            request_kwargs = create_mock.await_args.kwargs
            self.assertTrue(request_kwargs["stream"])
            self.assertEqual(
                request_kwargs["response_format"]["type"],
                "json_schema",
            )
            self.assertTrue(
                request_kwargs["response_format"]["json_schema"]["strict"]
            )
        finally:
            settings.api_key = original_api_key
            settings.enable_global_budget = original_global_budget
            settings.rate_limit = original_rate_limit
            MemoryCacheClient.request_limit_map.pop(quota_key, None)

    def test_invalid_structured_output_refunds_personal_quota(self) -> None:
        original_api_key = settings.api_key
        original_global_budget = settings.enable_global_budget
        original_rate_limit_enabled = settings.enable_rate_limit
        original_rate_limit = settings.rate_limit
        quota_key = f"{settings.project_name}:testclient"
        MemoryCacheClient.request_limit_map.pop(quota_key, None)
        settings.api_key = "test-key"
        settings.enable_global_budget = False
        settings.enable_rate_limit = True
        settings.rate_limit = (1, 60)
        try:
            with patch(
                "src.chatgpt_router.client.chat.completions.create",
                new=AsyncMock(return_value=FakeOpenAIStream(["not-json"])),
            ):
                response = TestClient(app).post(
                    "/api/divination",
                    json={"prompt": "梦" * 20, "prompt_type": "dream"},
                    headers={"Authorization": "Bearer xxx"},
                )

            self.assertIn("event: FatalError", response.text)
            self.assertIn("解梦结果格式异常", response.text)
            self.assertEqual(
                MemoryCacheClient.get_rate_limit_count(quota_key, 60),
                0,
            )
        finally:
            settings.api_key = original_api_key
            settings.enable_global_budget = original_global_budget
            settings.enable_rate_limit = original_rate_limit_enabled
            settings.rate_limit = original_rate_limit
            MemoryCacheClient.request_limit_map.pop(quota_key, None)

    def test_truncated_structured_output_refunds_personal_quota(self) -> None:
        original_api_key = settings.api_key
        original_global_budget = settings.enable_global_budget
        original_rate_limit_enabled = settings.enable_rate_limit
        original_rate_limit = settings.rate_limit
        quota_key = f"{settings.project_name}:testclient"
        MemoryCacheClient.request_limit_map.pop(quota_key, None)
        settings.api_key = "test-key"
        settings.enable_global_budget = False
        settings.enable_rate_limit = True
        settings.rate_limit = (1, 60)
        try:
            with patch(
                "src.chatgpt_router.client.chat.completions.create",
                new=AsyncMock(return_value=FakeOpenAIStream(
                    [make_analysis_json()],
                    finish_reason="length",
                )),
            ):
                response = TestClient(app).post(
                    "/api/divination",
                    json={"prompt": "梦" * 20, "prompt_type": "dream"},
                    headers={"Authorization": "Bearer xxx"},
                )

            self.assertIn("event: FatalError", response.text)
            self.assertNotIn("event: analysis", response.text)
            self.assertEqual(
                MemoryCacheClient.get_rate_limit_count(quota_key, 60),
                0,
            )
        finally:
            settings.api_key = original_api_key
            settings.enable_global_budget = original_global_budget
            settings.enable_rate_limit = original_rate_limit_enabled
            settings.rate_limit = original_rate_limit
            MemoryCacheClient.request_limit_map.pop(quota_key, None)

    def test_image_token_failure_does_not_refund_completed_analysis(self) -> None:
        original_api_key = settings.api_key
        original_global_budget = settings.enable_global_budget
        original_rate_limit_enabled = settings.enable_rate_limit
        original_rate_limit = settings.rate_limit
        quota_key = f"{settings.project_name}:testclient"
        MemoryCacheClient.request_limit_map.pop(quota_key, None)
        settings.api_key = "test-key"
        settings.enable_global_budget = False
        settings.enable_rate_limit = True
        settings.rate_limit = (1, 60)
        try:
            with patch(
                "src.chatgpt_router.client.chat.completions.create",
                new=AsyncMock(return_value=FakeOpenAIStream([make_analysis_json()])),
            ), patch(
                "src.chatgpt_router.create_image_token",
                side_effect=RuntimeError("cache unavailable"),
            ):
                response = TestClient(app).post(
                    "/api/divination",
                    json={"prompt": "梦" * 20, "prompt_type": "dream"},
                    headers={"Authorization": "Bearer xxx"},
                )

            self.assertIn("event: analysis", response.text)
            self.assertIn("event: image_error", response.text)
            self.assertIn("event: done", response.text)
            self.assertNotIn("event: FatalError", response.text)
            self.assertEqual(
                MemoryCacheClient.get_rate_limit_count(quota_key, 60),
                1,
            )
        finally:
            settings.api_key = original_api_key
            settings.enable_global_budget = original_global_budget
            settings.enable_rate_limit = original_rate_limit_enabled
            settings.rate_limit = original_rate_limit
            MemoryCacheClient.request_limit_map.pop(quota_key, None)

    def test_quota_reports_global_service_availability(self) -> None:
        original_global_budget = settings.enable_global_budget
        original_global_text_limit = settings.global_text_limit
        settings.enable_global_budget = True
        settings.global_text_limit = 0
        try:
            response = TestClient(app).get(
                "/api/v1/quota",
                headers={"Authorization": "Bearer xxx"},
            )
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.json()["service_available"])
        finally:
            settings.enable_global_budget = original_global_budget
            settings.global_text_limit = original_global_text_limit

    def test_saved_dream_can_receive_a_new_image_token(self) -> None:
        original_rate_limit_enabled = settings.enable_rate_limit
        settings.enable_rate_limit = False
        try:
            response = TestClient(app).post(
                "/api/dream-image/token",
                json={
                    "dream": "梦" * 20,
                    "interpretation": "这是一段已保存的梦境解读。",
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertGreaterEqual(len(response.json()["token"]), 20)
        finally:
            settings.enable_rate_limit = original_rate_limit_enabled

    def test_saved_image_token_refresh_is_rate_limited(self) -> None:
        original_rate_limit_enabled = settings.enable_rate_limit
        retry_key = f"{settings.project_name}:image-retry-token:testclient"
        MemoryCacheClient.request_limit_map.pop(retry_key, None)
        settings.enable_rate_limit = False
        payload = {
            "dream": "梦" * 20,
            "interpretation": "这是一段已保存的梦境解读。",
        }
        try:
            for _ in range(IMAGE_RETRY_TOKEN_LIMIT):
                response = TestClient(app).post(
                    "/api/dream-image/token",
                    json=payload,
                )
                self.assertEqual(response.status_code, 200)

            response = TestClient(app).post(
                "/api/dream-image/token",
                json=payload,
            )
            self.assertEqual(response.status_code, 429)
            self.assertEqual(
                MemoryCacheClient.get_rate_limit_count(
                    retry_key,
                    IMAGE_RETRY_TOKEN_WINDOW_SECONDS,
                ),
                IMAGE_RETRY_TOKEN_LIMIT,
            )
        finally:
            settings.enable_rate_limit = original_rate_limit_enabled
            MemoryCacheClient.request_limit_map.pop(retry_key, None)


if __name__ == "__main__":
    unittest.main()
