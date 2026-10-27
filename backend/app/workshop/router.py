import time
import socket
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from .activity import get_activities
from .auth import require_mentor
from .state import get_workshop_state
from ..generation.queue import get_queue
from ..schemas import ActivityItem, ClientSummary, MentorOverview, WorkshopStatus
from ..config import get_settings

router = APIRouter(dependencies=[Depends(require_mentor)])


def join_urls() -> tuple[list[str], Optional[str]]:
    addresses: set[str] = set()
    try:
        for result in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = result[4][0]
            if not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass
    settings = get_settings()
    public_url = settings.public_url.strip() or None
    public_file = Path(settings.data_dir) / "public_url.txt"
    if not public_url and public_file.is_file():
        try:
            public_url = public_file.read_text(encoding="utf-8").strip() or None
        except OSError:
            pass
    return [f"http://{address}:{settings.port}" for address in sorted(addresses)], public_url


def gpu_info() -> Optional[dict]:
    try:
        import torch
        if torch.cuda.is_available():
            properties = torch.cuda.get_device_properties(0)
            return {
                "name": torch.cuda.get_device_name(0),
                "vram_total_mb": int(properties.total_memory / (1024 * 1024)),
                "vram_used_mb": int(torch.cuda.memory_allocated(0) / (1024 * 1024)),
            }
    except (ImportError, RuntimeError):
        pass
    return None


class PauseRequest(BaseModel):
    paused: bool
    banner_message: Optional[str] = Field(default=None, max_length=180)


class SettingsRequest(BaseModel):
    learn_enabled: Optional[bool] = None
    max_jobs_per_client: Optional[int] = Field(default=None, ge=1, le=4)
    banner_message: Optional[str] = Field(default=None, max_length=180)


class BlockClientRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=160)
    blocked: bool


def current_status() -> WorkshopStatus:
    state = get_workshop_state()
    queue = get_queue().snapshot()
    return WorkshopStatus(
        paused=state.paused,
        banner_message=state.banner_message,
        learn_enabled=state.learn_enabled,
        queue_length=queue.length,
        running=queue.running,
        avg_seconds_per_image=queue.avg_seconds,
        supported_languages=["en"],
        max_jobs_per_client=state.max_jobs_per_client,
        server_version="1.0",
    )


@router.get("/mentor/overview", response_model=MentorOverview)
async def overview():
    state = get_workshop_state()
    queue = get_queue().snapshot()
    now = time.time()
    clients = [
        ClientSummary(
            client_id=client_id,
            nickname=stats.get("nickname"),
            jobs_total=stats.get("jobs_total", 0),
            blocked=client_id in state.blocked_clients,
            last_seen_s_ago=max(0, int(now - stats.get("last_seen", now))),
        )
        for client_id, stats in state.client_stats.items()
    ]
    from ..learn.service import get_usage

    lan_urls, public_url = join_urls()
    return MentorOverview(
        status=WorkshopStatus(
            paused=state.paused,
            banner_message=state.banner_message,
            learn_enabled=state.learn_enabled,
            queue_length=queue.length,
            running=queue.running,
            avg_seconds_per_image=queue.avg_seconds,
            supported_languages=["en"],
            max_jobs_per_client=state.max_jobs_per_client,
            server_version="1.0",
        ),
        learn_usage=get_usage(), clients=clients, lan_urls=lan_urls, public_url=public_url,
        gpu=gpu_info(), activity=get_activities()[-20:],
    )


@router.get("/mentor/activity", response_model=list[ActivityItem])
async def activity(since_id: int = Query(default=0, ge=0)):
    return get_activities(since_id)


@router.post("/mentor/pause", response_model=WorkshopStatus)
async def set_pause(request: PauseRequest):
    state = get_workshop_state()
    state.paused = request.paused
    if request.banner_message is not None:
        state.banner_message = request.banner_message.strip() or None
    return current_status()


@router.post("/mentor/settings", response_model=WorkshopStatus)
async def update_settings(request: SettingsRequest):
    state = get_workshop_state()
    changes = request.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if key == "banner_message":
            state.banner_message = value.strip() or None if value is not None else None
        else:
            setattr(state, key, value)
    return current_status()


@router.post("/mentor/block-client", response_model=ClientSummary)
async def block_client(request: BlockClientRequest):
    state = get_workshop_state()
    if request.blocked:
        state.blocked_clients.add(request.client_id)
    else:
        state.blocked_clients.discard(request.client_id)
    stats = state.client_stats.get(request.client_id, {})
    return ClientSummary(
        client_id=request.client_id, nickname=stats.get("nickname"),
        jobs_total=stats.get("jobs_total", 0), blocked=request.blocked,
        last_seen_s_ago=max(0, int(time.time() - stats.get("last_seen", time.time()))),
    )


@router.post("/mentor/clear-queue")
async def clear_queue():
    return {"cleared": get_queue().clear_pending()}
