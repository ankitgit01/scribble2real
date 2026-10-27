from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict, Any

Language = Literal["en", "hi"]
Style = Literal["realistic", "cartoon", "watercolor", "blueprint"]
JobState = Literal["queued", "running", "done", "error", "cancelled"]

class ErrorBody(BaseModel):
    code: str
    message: str
    retry_after_s: Optional[int] = None

class ClientInfo(BaseModel):
    client_id: str
    nickname: Optional[str] = None
    ip: str

class GenerateRequest(BaseModel):
    line_map_png_b64: str = Field(min_length=1, max_length=12_000_000)
    line_map_is_raster: bool = False
    color_layer_png_b64: Optional[str] = Field(default=None, max_length=12_000_000)
    reference_png_b64: Optional[str] = Field(default=None, max_length=12_000_000)
    prompt: str = Field(default="", max_length=300)
    style: Style = "realistic"
    mode: Literal["fresh", "refine"] = "fresh"
    quality: Literal["fast", "better"] = "fast"
    fidelity: float = Field(default=0.8, ge=0, le=1)
    creativity: float = Field(default=0.5, ge=0, le=1)
    seed: Optional[int] = None

class JobAccepted(BaseModel):
    job_id: str
    status: JobState
    queue_position: int

class JobStatus(BaseModel):
    job_id: str
    status: JobState
    queue_position: Optional[int] = None
    progress: float = 0.0
    result_url: Optional[str] = None
    seed_used: Optional[int] = None
    elapsed_ms: Optional[int] = None
    final_prompt: Optional[str] = None
    color_words: List[str] = Field(default_factory=list)
    error: Optional[ErrorBody] = None

class PreprocessRequest(BaseModel):
    image_b64: str
    kind: Literal["drawing", "photo"]

class PreprocessResponse(BaseModel):
    cleaned_png_b64: str
    width: int
    height: int
    notes: List[str]

class LearnRequest(BaseModel):
    scribble_png_b64: str = Field(min_length=1, max_length=12_000_000)
    context_png_b64: Optional[str] = Field(default=None, max_length=12_000_000)
    generated_png_b64: Optional[str] = Field(default=None, max_length=12_000_000)
    prompt: str = ""
    class_prompt: str = Field(default="", max_length=180)
    mode: Literal["fresh", "refine"] = "fresh"
    language: Language = "en"

class LearnResponse(BaseModel):
    title: str
    what_it_is: str
    key_facts: List[str]
    how_it_works_or_design_notes: str
    question_detected: bool
    question_text: Optional[str] = None
    answer: Optional[str] = None
    related_topics: List[str]
    confidence: Literal["high", "low"]
    safety_flag: Literal["ok", "unsafe", "off_topic"]
    suggested_prompt: str
    provider_used: str
    cached: bool

class WorkshopStatus(BaseModel):
    paused: bool
    banner_message: Optional[str] = None
    learn_enabled: bool
    queue_length: int
    running: int
    avg_seconds_per_image: Optional[float] = None
    supported_languages: List[Language]
    max_jobs_per_client: int
    server_version: str

class LearnUsage(BaseModel):
    used: int
    cap: int
    last_provider: Optional[str] = None

class ActivityItem(BaseModel):
    id: int
    ts: float
    client_id: str
    nickname: Optional[str] = None
    kind: Literal["generate", "learn", "blocked_prompt", "error"]
    prompt: Optional[str] = None
    status: Optional[str] = None
    thumb_data_url: Optional[str] = None

class ClientSummary(BaseModel):
    client_id: str
    nickname: Optional[str] = None
    jobs_total: int
    blocked: bool
    last_seen_s_ago: int

class MentorOverview(BaseModel):
    status: WorkshopStatus
    learn_usage: LearnUsage
    clients: List[ClientSummary]
    lan_urls: List[str]
    public_url: Optional[str] = None
    gpu: Optional[Dict[str, Any]] = None
    activity: List[ActivityItem]

class HealthResponse(BaseModel):
    ok: bool
    model_loaded: bool
    gpu: Optional[Dict[str, Any]] = None
    version: str
