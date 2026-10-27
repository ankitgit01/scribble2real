from fastapi import Request
from fastapi.responses import JSONResponse
from typing import Optional

class AppError(Exception):
    def __init__(self, code: str, message: str, status: Optional[int] = None, retry_after_s: Optional[int] = None):
        self.code = code
        self.message = message
        self.status = status or 400
        self.retry_after_s = retry_after_s

def install_error_handlers(app):
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        body = {"code": exc.code, "message": exc.message}
        if exc.retry_after_s is not None:
            body["retry_after_s"] = exc.retry_after_s
        return JSONResponse(status_code=exc.status, content={"error": body})