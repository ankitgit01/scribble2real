from fastapi import APIRouter, Request
from typing import Optional
from .schemas import HealthResponse, WorkshopStatus, PreprocessRequest, PreprocessResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health(request: Request):
    model_loaded = getattr(request.app.state, "model_loaded", False)
    gpu_info = None
    try:
        import torch
        if torch.cuda.is_available():
            gpu_info = {
                "name": torch.cuda.get_device_name(0),
                "vram_total_mb": int(torch.cuda.get_device_properties(0).total_memory / (1024**2)),
                "vram_used_mb": 0
            }
    except ImportError:
        pass

    return HealthResponse(
        ok=True,
        model_loaded=model_loaded,
        gpu=gpu_info,
        version="1.0.0"
    )

@router.get("/workshop/status", response_model=WorkshopStatus)
async def workshop_status():
    from .workshop.router import current_status
    return current_status()

@router.post("/preprocess", response_model=PreprocessResponse)
async def preprocess(req: PreprocessRequest):
    from .config import get_settings
    from .preprocess import decode_image_b64, normalize_drawing, cleanup_photo, encode_png_b64
    image = decode_image_b64(req.image_b64, get_settings().max_request_bytes)
    if req.kind == "photo":
        cleaned, notes = cleanup_photo(image)
    else:
        cleaned, notes = normalize_drawing(image), ["Drawing fitted to the canvas"]
    return PreprocessResponse(
        cleaned_png_b64=encode_png_b64(cleaned),
        width=1024,
        height=1024,
        notes=notes
    )
