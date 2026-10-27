from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Optional

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)
RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


def _clean_json(text: str) -> dict[str, Any]:
    value = text.strip()
    value = re.sub(r"^```(?:json)?\s*|\s*```$", "", value, flags=re.IGNORECASE)
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("The AI provider returned a non-object response.")
    return parsed


def _json_schema(value: Any) -> Any:
    if isinstance(value, list):
        return [_json_schema(item) for item in value]
    if not isinstance(value, dict):
        return value
    result: dict[str, Any] = {}
    for key, item in value.items():
        if key == "nullable":
            continue
        if key == "type" and isinstance(item, str):
            result[key] = item.lower()
        else:
            result[key] = _json_schema(item)
    if value.get("nullable") and isinstance(value.get("type"), str):
        result["type"] = [value["type"].lower(), "null"]
    if result.get("type") == "object":
        result.setdefault("additionalProperties", False)
    return result


def _data_url(value: str) -> str:
    if value.startswith("data:"):
        return value
    return f"data:image/jpeg;base64,{value}"


class VisionProvider:
    async def generate_json(self, system: str, user_text: str, images: list[str], schema: dict) -> dict[str, Any]:
        raise NotImplementedError

    async def generate_text(self, system: str, user_text: str) -> str:
        raise NotImplementedError


class GeminiProvider(VisionProvider):
    def __init__(self, api_key: str, model: str, fallback_model: Optional[str] = None):
        self.api_key = api_key
        self.models = list(dict.fromkeys([model or "gemini-3.8-flash", fallback_model or "gemini-3.8-flash"]))

    async def _request(self, model: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {"x-goog-api-key": self.api_key, "content-type": "application/json"}
        last_error: Optional[Exception] = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(35, connect=10)) as client:
            for attempt in range(3):
                try:
                    response = await client.post(url, headers=headers, json=payload)
                    if response.status_code in RETRYABLE_STATUS and attempt < 2:
                        retry_header = response.headers.get("retry-after")
                        delay = min(8.0, float(retry_header)) if retry_header and retry_header.isdigit() else (0.6 * (2 ** attempt))
                        await asyncio.sleep(delay)
                        continue
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPStatusError as error:
                    last_error = error
                    if error.response.status_code not in RETRYABLE_STATUS or attempt == 2:
                        break
                except (httpx.TimeoutException, httpx.NetworkError, json.JSONDecodeError) as error:
                    last_error = error
                    if attempt == 2:
                        break
                    await asyncio.sleep(0.6 * (2 ** attempt))
        if last_error:
            raise last_error
        raise RuntimeError("Gemini request did not return a response")

    async def _generate(
        self,
        system: str,
        user_text: str,
        images: list[str],
        schema: Optional[dict] = None,
        models: Optional[list[str]] = None,
    ) -> str:
        parts: list[dict[str, Any]] = [{"text": user_text}]
        for encoded in images:
            data_url = _data_url(encoded)
            header, data = data_url.split(",", 1)
            mime_type = header.partition(":")[2].partition(";")[0]
            parts.append({"inlineData": {"mimeType": mime_type, "data": data}})
        generation: dict[str, Any] = {"temperature": 0.25, "maxOutputTokens": 1200}
        if schema:
            generation.update({"responseMimeType": "application/json", "responseSchema": schema})
        payload = {"systemInstruction": {"parts": [{"text": system}]},
                   "contents": [{"role": "user", "parts": parts}], "generationConfig": generation}
        last_error: Optional[Exception] = None
        for model in models or self.models:
            try:
                response = await self._request(model, payload)
                candidates = response.get("candidates") or []
                content = candidates[0].get("content", {}) if candidates else {}
                text = "".join(part.get("text", "") for part in content.get("parts", []))
                if not text:
                    raise ValueError("Gemini returned no text content")
                return text
            except httpx.HTTPStatusError as error:
                last_error = error
                if error.response.status_code not in {500, 502, 503, 504}:
                    break
                continue
        if last_error:
            raise last_error
        raise RuntimeError("Gemini did not return a response")

    async def generate_json(self, system: str, user_text: str, images: list[str], schema: dict) -> dict[str, Any]:
        last_error: Optional[Exception] = None
        request = f"Sketch request context:\n{user_text or '(none)'}\nAnalyze the image and return the requested JSON."
        for model in self.models:
            try:
                text = await self._generate(system, request, images, schema, models=[model])
                return _clean_json(text)
            except (ValueError, json.JSONDecodeError, httpx.HTTPStatusError) as error:
                last_error = error
                if isinstance(error, httpx.HTTPStatusError) and error.response.status_code not in {500, 502, 503, 504}:
                    break
        if last_error:
            raise last_error
        raise RuntimeError("Gemini did not return a valid explanation")

    async def generate_text(self, system: str, user_text: str) -> str:
        return (await self._generate(system, user_text, [])).strip()


class OpenAICompatibleVisionProvider(VisionProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
        extra_headers: Optional[dict[str, str]] = None,
        fallback_models: Optional[list[str]] = None,
        native_model_fallbacks: bool = False,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.extra_headers = extra_headers or {}
        self.fallback_models = list(dict.fromkeys(item.strip() for item in (fallback_models or []) if item.strip() and item.strip() != model))
        self.native_model_fallbacks = native_model_fallbacks

    async def _completion(self, system: str, user_text: str, images: list[str], schema: Optional[dict] = None) -> str:
        content: list[dict[str, Any]] = [{"type": "text", "text": f"Sketch request context:\n{user_text or '(none)'}\nReturn the requested result."}]
        content.extend({"type": "image_url", "image_url": {"url": _data_url(image)}} for image in images)
        payload: dict[str, Any] = {
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}],
            "temperature": 0.2,
            "max_tokens": 1200,
        }
        if self.native_model_fallbacks and self.fallback_models:
            # OpenRouter can route through the ordered list itself and move on
            # when a model is rate-limited, avoiding repeated calls to one free tier.
            payload["models"] = [self.model, *self.fallback_models]
        else:
            payload["model"] = self.model
        if schema:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "learn_explanation",
                    "strict": True,
                    "schema": _json_schema(schema),
                },
            }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json", **self.extra_headers}
        last_error: Optional[Exception] = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(35, connect=10)) as client:
            for attempt in range(3):
                try:
                    response = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                    if response.status_code in RETRYABLE_STATUS and attempt < 2:
                        await asyncio.sleep(0.6 * (2 ** attempt))
                        continue
                    response.raise_for_status()
                    body = response.json()
                    return body["choices"][0]["message"]["content"]
                except httpx.HTTPStatusError as error:
                    last_error = error
                    if error.response.status_code not in RETRYABLE_STATUS or attempt == 2:
                        break
                except (httpx.TimeoutException, httpx.NetworkError, json.JSONDecodeError, KeyError, IndexError, TypeError) as error:
                    last_error = error
                    if attempt == 2:
                        break
                    await asyncio.sleep(0.6 * (2 ** attempt))
        if last_error:
            raise last_error
        raise RuntimeError("Provider request did not return a response")

    async def generate_json(self, system: str, user_text: str, images: list[str], schema: dict) -> dict[str, Any]:
        return _clean_json(await self._completion(system, user_text, images, schema))

    async def generate_text(self, system: str, user_text: str) -> str:
        return (await self._completion(system, user_text, [])).strip()


def get_providers() -> dict[str, VisionProvider]:
    settings = get_settings()
    providers: dict[str, VisionProvider] = {}
    if settings.gemini_api_key:
        providers["gemini"] = GeminiProvider(settings.gemini_api_key, settings.gemini_model or "gemini-3.8-flash", settings.gemini_fallback_model)
    if settings.openrouter_api_key:
        openrouter_fallbacks = [
            model.strip()
            for model in settings.openrouter_fallback_models.split(",")
            if model.strip()
        ]
        providers["openrouter"] = OpenAICompatibleVisionProvider(
            settings.openrouter_api_key,
            settings.openrouter_model or "google/gemini-3.8-flash",
            "https://openrouter.ai/api/v1",
            {"HTTP-Referer": "https://scribble2real.local", "X-Title": "Scribble2Real"},
            fallback_models=openrouter_fallbacks,
            native_model_fallbacks=True,
        )
    if settings.groq_api_key:
        providers["groq"] = OpenAICompatibleVisionProvider(
            settings.groq_api_key,
            settings.groq_model or "qwen/qwen3.8-27b",
            "https://api.groq.com/openai/v1",
        )
    return providers
