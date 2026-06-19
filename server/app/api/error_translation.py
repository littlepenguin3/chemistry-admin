from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from server.app.domains.errors import DomainHTTPException


async def domain_http_exception_handler(_request: Request, exc: DomainHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
