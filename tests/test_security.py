import unittest
import uuid

from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from src.app import app
from src.cache.memory_client import MemoryCacheClient
from src.config import settings
from src.limiter import get_real_ipaddr


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

    def test_anonymous_daily_quota_is_two_requests(self) -> None:
        self.assertEqual(settings.rate_limit, (2, 24 * 60 * 60))
        self.assertEqual(settings.get_human_rate_limit(), "2次/24小时")


if __name__ == "__main__":
    unittest.main()
