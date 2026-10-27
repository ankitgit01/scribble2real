import base64
import io
from types import SimpleNamespace

import pytest
import httpx
from PIL import Image

from app.learn import service
from app.schemas import ClientInfo, LearnRequest


def image_b64():
    output = io.BytesIO()
    Image.new("RGB", (1024, 1024), "white").save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


class _VisionProvider:
    def __init__(self, response=None, error=None):
        self.response = response or {
            "title": "A paper kite", "what_it_is": "A kite catches moving air.",
            "key_facts": ["Air provides lift."], "how_it_works_or_design_notes": "A tail adds stability.",
            "question_detected": False, "related_topics": ["Wind"], "confidence": "high",
            "safety_flag": "ok", "suggested_prompt": "A colorful kite in a blue sky.",
        }
        self.error = error
        self.calls = 0

    async def generate_json(self, system, user_text, images, schema):
        self.calls += 1
        assert images[0].startswith("data:image/jpeg;base64,")
        if self.error:
            raise self.error
        return dict(self.response)

    async def generate_text(self, system, user_text):
        return user_text


@pytest.fixture
def settings(monkeypatch):
    current = SimpleNamespace(max_request_bytes=8_000_000, learn_daily_cap=80, learn_provider_order="gemini,openrouter")
    monkeypatch.setattr(service, "get_settings", lambda: current)
    monkeypatch.setattr(service, "_provider_cooldown_until", {})
    return current


@pytest.mark.asyncio
async def test_learn_falls_back_between_configured_providers_and_caches(settings, monkeypatch):
    unavailable = _VisionProvider(error=RuntimeError("provider temporarily unavailable"))
    working = _VisionProvider()
    monkeypatch.setattr(service, "get_providers", lambda: {"gemini": unavailable, "openrouter": working})
    request = LearnRequest(scribble_png_b64=image_b64(), prompt="kite", mode="fresh", language="en")
    client = ClientInfo(client_id="learn-test", ip="127.0.0.1")

    first = await service.analyze(request, client)
    second = await service.analyze(request, client)

    assert first.title == "A paper kite"
    assert first.provider_used == "openrouter"
    assert first.cached is False
    assert second.cached is True
    assert unavailable.calls == 1
    assert working.calls == 1


@pytest.mark.asyncio
async def test_downscale_rejects_invalid_image(settings):
    with pytest.raises(Exception, match="could not be decoded"):
        await service._downscale_b64("bm90LWEtcG5n")


@pytest.mark.asyncio
async def test_forbidden_provider_is_cooled_down_while_fallback_keeps_working(settings, monkeypatch):
    settings.learn_provider_order = "groq,openrouter"
    request = httpx.Request("POST", "https://example.test/chat/completions")
    response = httpx.Response(403, request=request)
    blocked = _VisionProvider(error=httpx.HTTPStatusError("forbidden", request=request, response=response))
    fallback = _VisionProvider()
    monkeypatch.setattr(service, "get_providers", lambda: {"groq": blocked, "openrouter": fallback})
    client = ClientInfo(client_id="cooldown-test", ip="127.0.0.1")

    first = await service.analyze(LearnRequest(scribble_png_b64=image_b64(), prompt="first subject"), client)
    second = await service.analyze(LearnRequest(scribble_png_b64=image_b64(), prompt="second subject"), client)

    assert first.provider_used == "openrouter"
    assert second.provider_used == "openrouter"
    assert blocked.calls == 1
    assert fallback.calls == 2
