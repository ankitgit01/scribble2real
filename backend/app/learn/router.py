from fastapi import APIRouter, Depends
from ..schemas import LearnRequest, LearnResponse
from .service import analyze
from ..deps import get_client_info

router = APIRouter()

@router.post("/learn", response_model=LearnResponse)
async def learn_endpoint(req: LearnRequest, client=Depends(get_client_info)):
    try:
        from ..workshop.hooks import check_learn_allowed, record_event
        check_learn_allowed(client)
    except ImportError:
        record_event = lambda *args, **kwargs: None

    response = await analyze(req, client)
    record_event("learn", client, prompt=req.prompt, status="success")
    return response