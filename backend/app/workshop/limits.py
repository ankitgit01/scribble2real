import time
from .state import get_workshop_state
from ..config import get_settings
from ..errors import AppError
from ..generation.queue import get_queue

_client_last_generate = {}
_client_last_learn = {}

def check_limits(client_id: str, is_learn: bool = False):
    state = get_workshop_state()
    settings = get_settings()
    
    if client_id in state.blocked_clients:
        raise AppError("CLIENT_BLOCKED", "Your access has been paused by the mentor.", status=403)
        
    now = time.time()
    if state.client_stats.get(client_id):
        state.client_stats[client_id]["last_seen"] = now
    else:
        state.client_stats[client_id] = {"jobs_total": 0, "last_seen": now}

    if is_learn:
        last = _client_last_learn.get(client_id, 0)
        if now - last < settings.learn_per_client_interval_s:
            raise AppError("RATE_LIMITED", "Please wait before asking another question.", status=429, retry_after_s=settings.learn_per_client_interval_s)
        _client_last_learn[client_id] = now
    else:
        last = _client_last_generate.get(client_id, 0)
        if now - last < settings.client_cooldown_s:
            raise AppError("RATE_LIMITED", "Please wait before generating again.", status=429, retry_after_s=settings.client_cooldown_s)
            
        q = get_queue()
        if q.snapshot().length >= settings.max_queue:
            raise AppError("QUEUE_FULL", "Classroom queue is full, please wait.", status=429)
            
        active_jobs = len(q.jobs_for_client(client_id))
        if active_jobs >= state.max_jobs_per_client:
            raise AppError("RATE_LIMITED", "Wait for your current image to finish.", status=429)
            
        _client_last_generate[client_id] = now
        state.client_stats[client_id]["jobs_total"] += 1