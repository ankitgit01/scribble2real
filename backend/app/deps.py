from fastapi import Request, Header
from typing import Optional
from .schemas import ClientInfo
from .errors import AppError

def get_client_info(
    request: Request,
    x_client_id: Optional[str] = Header(None, alias="X-Client-Id"),
    x_nickname: Optional[str] = Header(None, alias="X-Nickname")
) -> ClientInfo:
    
    # Check the explicitly defined header first, fallback to the raw request headers
    client_id = x_client_id or request.headers.get("X-Client-Id")
    
    if not client_id or len(client_id) > 64:
        raise AppError(code="BAD_INPUT", message="Valid X-Client-Id header is required")
    
    nickname = x_nickname or request.headers.get("X-Nickname")
    if nickname:
        nickname = nickname[:20].strip()

    ip = request.client.host if request.client else "127.0.0.1"
    
    return ClientInfo(client_id=client_id, nickname=nickname, ip=ip)