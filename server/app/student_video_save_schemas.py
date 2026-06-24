from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


StudentVideoSaveType = Literal["watch_later", "favorite"]


class StudentVideoPersonalState(BaseModel):
    watch_later: bool = False
    watch_later_saved_at: str | None = None
    favorite: bool = False
    favorite_saved_at: str | None = None


class StudentVideoSaveRequest(BaseModel):
    placement_node_id: str = Field(min_length=1)
    media_id: str = Field(min_length=1)
    canonical_point_id: str | None = None
    source: str = "unknown"


class StudentVideoSaveResponse(BaseModel):
    save_type: StudentVideoSaveType
    placement_node_id: str
    canonical_point_id: str
    media_id: str
    active: bool
    personal_state: StudentVideoPersonalState
