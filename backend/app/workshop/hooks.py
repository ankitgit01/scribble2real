from .state import get_workshop_state
from .limits import check_limits
from .activity import add_activity
from ..errors import AppError
from ..schemas import ClientInfo

def check_generate_allowed(client: ClientInfo):
    state = get_workshop_state()
    if state.paused:
        raise AppError("PAUSED_BY_MENTOR", "Workshop is paused.", status=503)
    check_limits(client.client_id, is_learn=False)
    state.client_stats[client.client_id]["nickname"] = client.nickname

def check_learn_allowed(client: ClientInfo):
    state = get_workshop_state()
    if not state.learn_enabled:
        raise AppError("LEARN_DISABLED", "Explanations are disabled.", status=503)
    check_limits(client.client_id, is_learn=True)
    state.client_stats[client.client_id]["nickname"] = client.nickname

def record_event(kind: str, client: ClientInfo, prompt: str = None, status: str = None, image_png: bytes = None):
    add_activity(client.client_id, client.nickname, kind, prompt, status, image_png)
