from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from server.app.auth import AuthUser, require_roles
from server.app.domains.video_library.search import search_student_video_library
from server.app.student_video_library_schemas import StudentVideoLibrarySearchResponse


router = APIRouter(prefix="/api/student", tags=["student-video-library"])
StudentUser = Annotated[AuthUser, Depends(require_roles("student"))]


@router.get("/video-library/search", response_model=StudentVideoLibrarySearchResponse)
def video_library_search(
    user: StudentUser,
    q: Annotated[str, Query(max_length=120)] = "",
    limit: Annotated[int, Query(ge=1, le=50)] = 24,
    domain: Annotated[str, Query()] = "experiment_video",
) -> StudentVideoLibrarySearchResponse:
    if domain != "experiment_video":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video library search only supports experiment_video")
    return search_student_video_library(user, query=q, limit=limit)
