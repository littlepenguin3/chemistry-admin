from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, Path, UploadFile

from server.app.auth import AuthUser, require_roles
from server.app.experiment_admin_schemas import (
    ExperimentCreateRequest,
    ExperimentExistingVideoBindRequest,
    ExperimentPointLearningContentRequest,
    ExperimentPointPublicationRequest,
    ExperimentPointRelatedLinksRequest,
    ExperimentUpdateRequest,
    ExperimentVideoPointResourceRequest,
)
from server.app.domains.experiment_points.learning_content import (
    replace_point_related_links,
    save_point_learning_content,
    set_point_publication_status,
)
from server.app.domains.video_library.index_client import video_library_index_diagnostics
from server.app.domains.catalog.experiments import (
    add_experiment_video_point_resource,
    bind_existing_experiment_video,
    create_experiment,
    get_experiment,
    get_experiment_video_points,
    list_experiment_videos,
    list_experiments_overview,
    replace_experiment_chapter_bindings,
    update_experiment,
    upload_experiment_video,
)


router = APIRouter(prefix="/api/admin", tags=["experiment-admin"])


@router.get("/experiments")
async def admin_list_experiments(
    chapter_id: str | None = None,
    status_filter: str | None = None,
    include_archived: bool = False,
    video_status: str | None = None,
    question_status: str | None = None,
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return list_experiments_overview(
        chapter_id=chapter_id,
        status_filter=status_filter,
        include_archived=include_archived,
        video_status=video_status,
        question_status=question_status,
    )


@router.post("/experiments")
async def admin_create_experiment(
    payload: ExperimentCreateRequest,
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return create_experiment(payload=payload, user=user)


@router.get("/experiments/{experiment_id}")
async def admin_get_experiment(
    experiment_id: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return get_experiment(experiment_id=experiment_id)


@router.patch("/experiments/{experiment_id}")
async def admin_update_experiment(
    payload: ExperimentUpdateRequest,
    experiment_id: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return update_experiment(payload=payload, experiment_id=experiment_id, user=user)


@router.put("/experiments/{experiment_id}/chapter-bindings")
async def admin_replace_chapter_bindings(
    bindings: list[Any],
    experiment_id: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return replace_experiment_chapter_bindings(bindings=bindings, experiment_id=experiment_id, user=user)


@router.post("/experiments/{experiment_id}/videos/upload")
async def admin_upload_experiment_video(
    experiment_id: str = Path(min_length=1),
    title: str = Form(...),
    file: UploadFile = File(...),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    content = await file.read()
    return upload_experiment_video(
        experiment_id=experiment_id,
        title=title,
        filename=file.filename,
        content=content,
        content_type=file.content_type,
        user=user,
    )


@router.post("/experiments/{experiment_id}/videos/bind")
async def admin_bind_existing_experiment_video(
    payload: ExperimentExistingVideoBindRequest,
    experiment_id: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return bind_existing_experiment_video(payload=payload, experiment_id=experiment_id, user=user)


@router.get("/experiments/{experiment_id}/video-points")
async def admin_get_experiment_video_points(
    experiment_id: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return get_experiment_video_points(experiment_id=experiment_id)


@router.post("/experiments/{experiment_id}/video-points/{point_key}/resources")
async def admin_add_experiment_video_point_resource(
    payload: ExperimentVideoPointResourceRequest,
    experiment_id: str = Path(min_length=1),
    point_key: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return add_experiment_video_point_resource(payload=payload, experiment_id=experiment_id, point_key=point_key, user=user)


@router.put("/experiments/{experiment_id}/video-points/{point_key}/content")
async def admin_save_experiment_point_content(
    payload: ExperimentPointLearningContentRequest,
    experiment_id: str = Path(min_length=1),
    point_key: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return save_point_learning_content(payload=payload, experiment_id=experiment_id, point_key=point_key, user=user)


@router.post("/experiments/{experiment_id}/video-points/{point_key}/publication")
async def admin_set_experiment_point_publication(
    payload: ExperimentPointPublicationRequest,
    experiment_id: str = Path(min_length=1),
    point_key: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return set_point_publication_status(payload=payload, experiment_id=experiment_id, point_key=point_key, user=user)


@router.put("/experiments/{experiment_id}/video-points/{point_key}/related-links")
async def admin_replace_experiment_point_related_links(
    payload: ExperimentPointRelatedLinksRequest,
    experiment_id: str = Path(min_length=1),
    point_key: str = Path(min_length=1),
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return replace_point_related_links(payload=payload, experiment_id=experiment_id, point_key=point_key, user=user)


@router.get("/experiment-videos")
async def admin_list_experiment_videos(
    experiment_id: str | None = None,
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return list_experiment_videos(experiment_id=experiment_id)


@router.get("/video-library/index/diagnostics")
async def admin_video_library_index_diagnostics(
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> dict[str, Any]:
    return video_library_index_diagnostics()
