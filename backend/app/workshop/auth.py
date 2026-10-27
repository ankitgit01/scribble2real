import hmac
from fastapi import Request, Header
from typing import Optional
from ..config import get_settings
from ..errors import AppError

def require_mentor(
    request: Request, 
    x_mentor_pin: Optional[str] = Header(None, alias="X-Mentor-Pin")
):
    settings = get_settings()
    pin = x_mentor_pin or request.headers.get("X-Mentor-Pin", "")
    if not hmac.compare_digest(pin.encode(), settings.mentor_pin.encode()):
        raise AppError("UNAUTHORIZED", "Invalid mentor PIN", status=401)
    return True