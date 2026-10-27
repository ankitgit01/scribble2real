from __future__ import annotations

import base64
import binascii
import io
import secrets
import time
from typing import Any

from fastapi import APIRouter, Depends, Response
from PIL import Image, UnidentifiedImageError
import numpy as np

from ..config import get_settings
from ..deps import get_client_info
from ..errors import AppError
from ..prompts import build_prompt
from ..schemas import GenerateRequest, JobAccepted, JobStatus
from ..workshop.hooks import check_generate_allowed, record_event
from ..workshop.state import get_workshop_state
from .presets import PRESETS, creativity_to_guidance, fidelity_to_control_scale
from .queue import Job, get_queue
from ..preprocess import composite_to_control_image, extract_color_words, to_control_image

router = APIRouter()


def decode_request_image(encoded: str, name: str, *, keep_alpha: bool = False) -> Image.Image:
    if not encoded:
        raise AppError("BAD_INPUT", f"The {name} image is required.", status=400)
    payload = encoded.split(",", 1)[-1]
    # Reject oversized encoded input before allocating decoded image memory.
    max_encoded = int(get_settings().max_request_bytes * 4 / 3) + 8
    if len(payload) > max_encoded:
        raise AppError("BAD_INPUT", f"The {name} image is too large.", status=413)
    try:
        data = base64.b64decode(payload, validate=True)
        if len(data) > get_settings().max_request_bytes:
            raise AppError("BAD_INPUT", f"The {name} image is too large.", status=413)
        with Image.open(io.BytesIO(data)) as source:
            if source.width > 4096 or source.height > 4096:
                raise AppError("BAD_INPUT", f"The {name} image dimensions are too large.", status=413)
            source.load()
            return source.convert("RGBA" if keep_alpha else "RGB").copy()
    except AppError:
        raise
    except (binascii.Error, UnidentifiedImageError, OSError, ValueError) as error:
        raise AppError("BAD_INPUT", f"The {name} image is invalid. Upload a PNG sketch and try again.", status=400) from error


def prepare_generation(request: GenerateRequest) -> tuple[dict[str, Any], str, list[str]]:
    line_image = decode_request_image(request.line_map_png_b64, "sketch")
    line_array = np.asarray(line_image.convert("RGB"))[:, :, ::-1].copy()
    control_image = composite_to_control_image(line_array) if request.line_map_is_raster else to_control_image(line_array)
    color_words: list[str] = []
    if request.color_layer_png_b64:
        color_image = decode_request_image(request.color_layer_png_b64, "color", keep_alpha=True)
        color_words = extract_color_words(color_image)
    reference_image = None
    if request.mode == "refine":
        if not request.reference_png_b64:
            raise AppError("BAD_INPUT", "Sketch over the last result before generating in refine mode.", status=400)
        reference_image = decode_request_image(request.reference_png_b64, "reference")

    prompt_pair = build_prompt(request.prompt, color_words, request.style)
    preset = PRESETS[request.quality]
    seed = request.seed if request.seed is not None else secrets.randbelow(2**31 - 1)
    params = {
        "prompt": prompt_pair.positive,
        "negative_prompt": prompt_pair.negative,
        "control_image": control_image,
        "reference_image": reference_image,
        "mode": request.mode,
        "quality": request.quality,
        "steps": preset["steps"],
        "fidelity": request.fidelity,
        "control_scale": fidelity_to_control_scale(request.fidelity),
        "guidance": preset["guidance"] * creativity_to_guidance(request.creativity),
        "seed": seed,
    }
    return params, prompt_pair.positive, color_words


@router.post("/generate", response_model=JobAccepted, status_code=202)
async def generate(req: GenerateRequest, client=Depends(get_client_info)):
    check_generate_allowed(client)
    state = get_workshop_state()
    stats = state.client_stats.setdefault(client.client_id, {"jobs_total": 0, "last_seen": time.time()})
    stats["nickname"] = client.nickname

    params, final_prompt, color_words = prepare_generation(req)
    try:
        job = get_queue().submit(params, client, final_prompt, color_words)
    except RuntimeError as error:
        if str(error) == "QUEUE_FULL":
            raise AppError("QUEUE_FULL", "The image queue is full. Try again in a moment.", status=429) from error
        raise AppError("MODEL_NOT_READY", "The image model is still loading. Try again shortly.", status=503) from error
    record_event("generate", client, prompt=final_prompt, status="queued")
    snapshot = get_queue().snapshot()
    return JobAccepted(job_id=job.id, status=job.state, queue_position=snapshot.length)


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str, client=Depends(get_client_info)):
    queue = get_queue()
    job = queue.get(job_id)
    if not job:
        raise AppError("JOB_NOT_FOUND", "This image request has expired or could not be found.", status=404)
    if job.client_id != client.client_id:
        raise AppError("UNAUTHORIZED", "This image request belongs to another device.", status=403)
    with queue.lock:
        position = queue.pending.index(job_id) + 1 if job_id in queue.pending else None
        elapsed = int(((job.finished_at or time.time()) - job.started_at) * 1000) if job.started_at else None
        result_url = f"/api/jobs/{job_id}/result.png" if job.state == "done" else None
        return JobStatus(
            job_id=job.id, status=job.state, queue_position=position, progress=job.progress,
            result_url=result_url, seed_used=job.seed_used, elapsed_ms=elapsed,
            final_prompt=job.final_prompt, color_words=job.color_words, error=job.error,
        )


@router.get("/jobs/{job_id}/result.png")
async def get_job_result(job_id: str):
    job = get_queue().get(job_id)
    if not job or job.state != "done" or not job.result_bytes:
        raise AppError("JOB_NOT_FOUND", "The image is not ready or has expired.", status=404)
    return Response(content=job.result_bytes, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, client=Depends(get_client_info)):
    queue = get_queue()
    job = queue.get(job_id)
    if not job:
        raise AppError("JOB_NOT_FOUND", "This image request has expired or could not be found.", status=404)
    if job.client_id != client.client_id:
        raise AppError("UNAUTHORIZED", "This image request belongs to another device.", status=403)
    return {"cancelled": queue.cancel(job_id)}
