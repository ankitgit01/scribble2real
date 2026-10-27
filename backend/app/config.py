from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    static_dir: str = "../frontend/dist"
    data_dir: str = "../data"
    generation_backend: str = "diffusers"
    sd_base_model: str = "stable-diffusion-v1-5/stable-diffusion-v1-5"
    controlnet_model: str = "lllyasviel/sd-controlnet-scribble"
    lcm_lora: str = "latent-consistency/lcm-lora-sdv1-5"
    device: str = "cuda"
    torch_dtype: str = "float16"
    refine_method: str = "img2img"
    max_queue: int = 12
    max_jobs_per_client: int = 1
    client_cooldown_s: int = 3
    job_timeout_s: int = 90
    max_request_bytes: int = 8000000
    mentor_pin: str = ""
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = "gemini-3.8-flash"
    gemini_fallback_model: Optional[str] = "gemini-3.8-flash"
    openrouter_api_key: Optional[str] = None
    openrouter_model: Optional[str] = None
    openrouter_fallback_models: str = "google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
    groq_api_key: Optional[str] = None
    groq_model: Optional[str] = "qwen/qwen3.8-27b"
    learn_provider_order: str = "openrouter,groq,gemini"
    learn_daily_cap: int = 240
    learn_per_client_interval_s: int = 4
    activity_log_max: int = 60
    public_url: str = ""
    cors_origins: str = "*"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
