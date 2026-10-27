import base64
import io
import logging
import threading
import time
from datetime import datetime, timezone
from PIL import Image, UnidentifiedImageError

from ..schemas import LearnRequest, LearnResponse, LearnUsage
from .prompt import get_system_prompt, get_schema_dict
from .providers import get_providers
from .cache import get_cache
from ..config import get_settings
from ..errors import AppError
from ..languages import normalize_language

_usage_count = 0
_last_provider = None
_usage_lock = threading.Lock()
_usage_day = datetime.now(timezone.utc).date()
_provider_cooldown_until: dict[str, float] = {}
logger = logging.getLogger(__name__)


def _roll_usage_day() -> None:
    global _usage_count, _last_provider, _usage_day
    today = datetime.now(timezone.utc).date()
    with _usage_lock:
        if today != _usage_day:
            _usage_count = 0
            _last_provider = None
            _usage_day = today

def get_usage() -> LearnUsage:
    _roll_usage_day()
    settings = get_settings()
    with _usage_lock:
        return LearnUsage(used=_usage_count, cap=settings.learn_daily_cap, last_provider=_last_provider)

async def _downscale_b64(b64_str: str) -> str:
    encoded = b64_str.split(",", 1)[-1]
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
        if len(image_bytes) > get_settings().max_request_bytes:
            raise AppError("BAD_INPUT", "The image is too large for Learn.", status=413)
        with Image.open(io.BytesIO(image_bytes)) as source:
            source.load()
            image = source.convert("RGB")
    except AppError:
        raise
    except (ValueError, UnidentifiedImageError, OSError) as error:
        raise AppError("BAD_INPUT", "The Learn image could not be decoded.", status=400) from error
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=82, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")

async def analyze(req: LearnRequest, client) -> LearnResponse:
    global _usage_count, _last_provider
    _roll_usage_day()
    settings = get_settings()
    
    with _usage_lock:
        usage_count = _usage_count
    if usage_count >= settings.learn_daily_cap:
        raise AppError("QUOTA_EXHAUSTED", "Learn daily cap reached", status=429)

    lang = normalize_language(req.language)
    class_prompt = req.class_prompt.strip()
    provider_prompt = (
        f"Student's own prompt: {req.prompt.strip() or '(none)'}\n"
        f"Mentor's short class prompt or update: {class_prompt or '(none)'}\n"
        f"Workshop mode: {req.mode}. Analyze the sketch and return the requested explanation and image prompt."
    )
    cache = get_cache()
    cached_data = cache.get(req.scribble_png_b64, req.generated_png_b64, provider_prompt, req.mode, lang, req.context_png_b64)
    if cached_data:
        cached_response = dict(cached_data)
        cached_response["cached"] = True
        cached_response["safety_flag"] = "ok"
        return LearnResponse(**cached_response)

    system = get_system_prompt(lang)
    images = [await _downscale_b64(req.scribble_png_b64)]
    if req.context_png_b64:
        images.append(await _downscale_b64(req.context_png_b64))
    if req.generated_png_b64:
        images.append(await _downscale_b64(req.generated_png_b64))

    providers = get_providers()
    schema = get_schema_dict()
    
    order = [name.strip() for name in settings.learn_provider_order.split(",") if name.strip()]

    for provider_name in order:
            provider_name = provider_name.strip()
            provider = providers.get(provider_name)
            if not provider:
                continue
            if _provider_cooldown_until.get(provider_name, 0) > time.monotonic():
                continue
                
            try:
                result = await provider.generate_json(system, provider_prompt, images, schema)
                required = {"title", "what_it_is", "key_facts", "how_it_works_or_design_notes", "question_detected", "related_topics", "confidence", "suggested_prompt"}
                if not required.issubset(result):
                    raise ValueError("The provider response omitted required explanation fields")
                result["safety_flag"] = "ok"
                result["provider_used"] = provider_name
                result["cached"] = False
                _provider_cooldown_until.pop(provider_name, None)
                with _usage_lock:
                    _usage_count += 1
                    _last_provider = provider_name
                
                cache.set(result, req.scribble_png_b64, req.generated_png_b64, provider_prompt, req.mode, lang, req.context_png_b64)
                return LearnResponse(**result)
            except Exception as error:
                status = error.response.status_code if hasattr(error, "response") else None
                if status in {401, 403, 404}:
                    # Invalid credentials, organization policy, and missing
                    # model routes are configuration failures. Avoid making
                    # the same rejected call on every student request.
                    _provider_cooldown_until[provider_name] = time.monotonic() + 300
                logger.warning("Learn provider %s failed%s (%s)", provider_name, f" with HTTP {status}" if status else "", type(error).__name__)
                continue
                
    raise AppError("LEARN_UNAVAILABLE", "The explanation service is temporarily unavailable. Your image request can still continue.", status=502)

async def run_text_task(system: str, user_text: str) -> str:
    settings = get_settings()
    providers = get_providers()
    order = settings.learn_provider_order.split(",")
    for p in order:
        provider = providers.get(p.strip())
        if provider:
            try:
                return await provider.generate_text(system, user_text)
            except Exception:
                continue
    raise AppError("LEARN_UNAVAILABLE", "Translation failed", status=502)
