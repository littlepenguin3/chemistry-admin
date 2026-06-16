from __future__ import annotations

from fastapi import APIRouter


admin_router = APIRouter(prefix="/api/admin", tags=["experiment-admin"])
