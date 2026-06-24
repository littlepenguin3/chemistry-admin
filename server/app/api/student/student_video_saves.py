from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from server.app.auth import AuthUser, require_roles
from server.app.domains.student_home_feed import student_saved_video_feed
from server.app.domains.student_video_saves import set_student_video_save
from server.app.student_home_feed_schemas import StudentHomeVideoFeedResponse
from server.app.student_video_save_schemas import StudentVideoSaveRequest, StudentVideoSaveResponse


router = APIRouter(prefix="/api/student", tags=["student-video-saves"])
StudentUser = Annotated[AuthUser, Depends(require_roles("student"))]


@router.put("/video-saves/{save_type}", response_model=StudentVideoSaveResponse)
def save_student_video(
    save_type: Annotated[str, Path(min_length=1)],
    payload: StudentVideoSaveRequest,
    user: StudentUser,
) -> StudentVideoSaveResponse:
    return set_student_video_save(user, save_type=save_type, payload=payload, active=True)


@router.delete("/video-saves/{save_type}", response_model=StudentVideoSaveResponse)
def remove_student_video_save(
    save_type: Annotated[str, Path(min_length=1)],
    payload: StudentVideoSaveRequest,
    user: StudentUser,
) -> StudentVideoSaveResponse:
    return set_student_video_save(user, save_type=save_type, payload=payload, active=False)


@router.get("/video-saves/favorite/feed", response_model=StudentHomeVideoFeedResponse)
def favorite_video_feed(
    user: StudentUser,
    limit: Annotated[int, Query(ge=1, le=30)] = 12,
    cursor: Annotated[str | None, Query()] = None,
) -> StudentHomeVideoFeedResponse:
    return student_saved_video_feed(user, save_type="favorite", limit=limit, cursor=cursor)
