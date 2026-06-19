from __future__ import annotations

import json
import uuid
from typing import Any

from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from sqlalchemy import text

from server.app.infrastructure.database import db_session
from server.app.experiment_admin_schemas import (
    ExperimentChapterBinding,
    ExperimentCreateRequest,
    ExperimentExistingVideoBindRequest,
    ExperimentUpdateRequest,
    ExperimentVideoPointResourceRequest,
)
from server.app.domains.media.assets import create_media_asset
from server.app.domains.media.bindings import create_media_binding
from server.app.domains.experiment_points.learning_content import (
    ensure_active_point,
    ensure_canonical_points_for_experiment,
)
from server.app.domains.experiment_points.canonical_points import candidate_point_key as _candidate_point_key
from server.app.domains.experiment_points.workspace import point_workspace_payload

def _json(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False, default=str)


def _dump(model: Any) -> dict[str, Any]:
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


def _ensure_experiment(session: Any, experiment_id: str) -> dict[str, Any]:
    row = (
        session.execute(
            text(
                """
                SELECT id, code, title, title_en, summary, status, display_order, source_refs, metadata
                FROM formal_experiments
                WHERE id = :experiment_id
                """
            ),
            {"experiment_id": experiment_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formal experiment not found")
    return dict(row)

def _video_candidates(metadata: Any) -> list[str]:
    if not isinstance(metadata, dict):
        return []
    raw_candidates = metadata.get("video_candidates") or []
    if not isinstance(raw_candidates, list):
        return []
    candidates: list[str] = []
    seen: set[str] = set()
    for raw in raw_candidates:
        title = str(raw or "").strip()
        if not title or title in seen:
            continue
        seen.add(title)
        candidates.append(title)
    return candidates

def _experiment_video_points(experiment: dict[str, Any], resources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    by_key: dict[str, dict[str, Any]] = {}
    for index, title in enumerate(_video_candidates(experiment.get("metadata"))):
        point = {
            "point_key": _candidate_point_key(index, title),
            "point_title": title,
            "source": "candidate",
            "resources": [],
            "resource_count": 0,
            "published_count": 0,
        }
        points.append(point)
        by_key[point["point_key"]] = point

    legacy_point: dict[str, Any] | None = None
    for resource in resources:
        point_key = str(resource.get("point_key") or "").strip()
        point_title = str(resource.get("point_title") or "").strip()
        if point_key and point_key not in by_key:
            point = {
                "point_key": point_key,
                "point_title": point_title or str(resource.get("title") or resource.get("media_title") or point_key),
                "source": "stored",
                "resources": [],
                "resource_count": 0,
                "published_count": 0,
            }
            points.append(point)
            by_key[point_key] = point
        elif not point_key:
            if legacy_point is None:
                legacy_point = {
                    "point_key": "legacy-unassigned",
                    "point_title": "Unassigned resources",
                    "source": "legacy",
                    "resources": [],
                    "resource_count": 0,
                    "published_count": 0,
                }
                points.append(legacy_point)
                by_key[legacy_point["point_key"]] = legacy_point
            point_key = legacy_point["point_key"]

        point = by_key.get(point_key)
        if not point:
            continue
        point["resources"].append(resource)
        point["resource_count"] += 1
        if resource.get("binding_status") == "published":
            point["published_count"] += 1

    return points

def _normalize_chapter_ids(chapter_ids: list[Any] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in chapter_ids or []:
        if isinstance(raw, dict):
            chapter_id = str(raw.get("chapter_id") or "").strip()
        else:
            chapter_id = str(raw or "").strip()
        if not chapter_id or chapter_id in seen:
            continue
        seen.add(chapter_id)
        normalized.append(chapter_id)
    return normalized

def _bindings_from_chapter_ids(chapter_ids: list[Any] | None) -> list[ExperimentChapterBinding]:
    return [
        ExperimentChapterBinding(chapter_id=chapter_id, coverage_type="primary", sort_order=index + 1)
        for index, chapter_id in enumerate(_normalize_chapter_ids(chapter_ids))
    ]

def _normalize_binding_payload(
    *,
    chapter_ids: list[Any] | None = None,
    chapter_bindings: list[Any] | None = None,
) -> list[ExperimentChapterBinding]:
    if chapter_ids is not None:
        return _bindings_from_chapter_ids(chapter_ids)
    if chapter_bindings is None:
        return []
    bindings: list[ExperimentChapterBinding] = []
    for index, raw in enumerate(chapter_bindings):
        if isinstance(raw, ExperimentChapterBinding):
            chapter_id = raw.chapter_id
            notes = raw.notes
        elif isinstance(raw, dict):
            chapter_id = str(raw.get("chapter_id") or "").strip()
            notes = raw.get("notes")
        else:
            chapter_id = str(raw or "").strip()
            notes = None
        if not chapter_id:
            continue
        bindings.append(
            ExperimentChapterBinding(
                chapter_id=chapter_id,
                coverage_type="primary",
                notes=notes,
                sort_order=index + 1,
            )
        )
    return _bindings_from_chapter_ids([binding.chapter_id for binding in bindings])

def _new_custom_experiment_identity(session: Any) -> tuple[str, str, int]:
    display_order = int(session.execute(text("SELECT COALESCE(MAX(display_order), 0) + 1 FROM formal_experiments")).scalar_one())
    while True:
        token = uuid.uuid4().hex[:10].upper()
        experiment_id = f"EXP_CUSTOM_{token}"
        code = f"CUSTOM-{token}"
        exists = session.execute(
            text("SELECT 1 FROM formal_experiments WHERE id = :id OR code = :code"),
            {"id": experiment_id, "code": code},
        ).first()
        if not exists:
            return experiment_id, code, display_order

def _experiment_select_sql(where_clause: str = "") -> str:
    return f"""
        SELECT
          fe.id,
          fe.code,
          fe.title,
          fe.title_en,
          fe.summary,
          fe.status,
          fe.display_order,
          fe.source_refs,
          fe.metadata,
          fe.published_at,
          fe.created_at,
          fe.updated_at,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'chapter_id', ecb.chapter_id,
                'chapter_title', c.chapter_title,
                'chapter_number', c.chapter_number,
                'coverage_type', ecb.coverage_type,
                'notes', ecb.notes,
                'sort_order', ecb.sort_order
              )
              ORDER BY ecb.sort_order, c.chapter_number NULLS LAST, ecb.chapter_id
            )
            FROM experiment_chapter_bindings ecb
            LEFT JOIN chapters c ON c.id = ecb.chapter_id
            WHERE ecb.experiment_id = fe.id
          ), '[]'::jsonb) AS chapter_bindings,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'binding_id', mb.id,
                'media_id', ma.id,
                'title', COALESCE(mb.title, ma.title),
                'original_file_name', ma.original_file_name,
                'mime_type', ma.mime_type,
                'file_size_bytes', ma.file_size_bytes,
                'thumbnail_relative_path', ma.thumbnail_relative_path,
                'upload_status', ma.upload_status,
                'binding_status', mb.status,
                'point_key', mb.metadata->>'point_key',
                'point_title', mb.metadata->>'point_title',
                'published_at', mb.published_at
              )
              ORDER BY mb.sort_order, mb.created_at
            )
            FROM media_bindings mb
            JOIN media_assets ma ON ma.id = mb.media_asset_id
            WHERE mb.target_type = 'experiment'
              AND mb.target_id = fe.id
              AND mb.status <> 'archived'
          ), '[]'::jsonb) AS media_resources,
          (SELECT COUNT(*) FROM experiment_questions q WHERE q.experiment_id = fe.id AND q.status = 'published') AS published_question_count,
          (SELECT COUNT(*) FROM experiment_questions q WHERE q.experiment_id = fe.id AND q.status = 'draft') AS draft_question_count,
          (SELECT COUNT(*) FROM experiment_question_drafts d WHERE d.experiment_id = fe.id AND d.status = 'draft') AS generated_draft_count
        FROM formal_experiments fe
        {where_clause}
        ORDER BY fe.display_order, fe.code
    """

def _list_experiments(
    *,
    chapter_id: str | None = None,
    status_filter: str | None = None,
    include_archived: bool = False,
    video_status: str | None = None,
    question_status: str | None = None,
) -> list[dict[str, Any]]:
    filters: list[str] = ["COALESCE(fe.metadata->>'archived_by_catalog_seed', 'false') <> 'true'"]
    params: dict[str, Any] = {}
    if chapter_id:
        filters.append(
            """
            EXISTS (
              SELECT 1 FROM experiment_chapter_bindings ecb
              WHERE ecb.experiment_id = fe.id AND ecb.chapter_id = :chapter_id
            )
            """
        )
        params["chapter_id"] = chapter_id
    if status_filter:
        filters.append("fe.status = :status_filter")
        params["status_filter"] = status_filter
    elif not include_archived:
        filters.append("fe.status <> 'archived'")
    if video_status == "none":
        filters.append(
            """
            NOT EXISTS (
              SELECT 1 FROM media_bindings mb
              JOIN media_assets ma ON ma.id = mb.media_asset_id
              WHERE mb.target_type = 'experiment' AND mb.target_id = fe.id AND mb.status <> 'archived'
            )
            """
        )
    elif video_status:
        filters.append(
            """
            EXISTS (
              SELECT 1 FROM media_bindings mb
              JOIN media_assets ma ON ma.id = mb.media_asset_id
              WHERE mb.target_type = 'experiment'
                AND mb.target_id = fe.id
                AND mb.status <> 'archived'
                AND (ma.upload_status = :video_status OR mb.status = :video_status)
            )
            """
        )
        params["video_status"] = video_status
    if question_status == "empty":
        filters.append("NOT EXISTS (SELECT 1 FROM experiment_questions q WHERE q.experiment_id = fe.id)")
    elif question_status:
        filters.append(
            """
            EXISTS (
              SELECT 1 FROM experiment_questions q
              WHERE q.experiment_id = fe.id AND q.status = :question_status
            )
            """
        )
        params["question_status"] = question_status
    where_clause = "WHERE " + " AND ".join(filters) if filters else ""
    with db_session() as session:
        return [dict(row) for row in session.execute(text(_experiment_select_sql(where_clause)), params).mappings().all()]

def _list_experiment_video_resources(experiment_id: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    filters = ["mb.target_type = 'experiment'", "mb.status <> 'archived'"]
    if experiment_id:
        filters.append("mb.target_id = :experiment_id")
        params["experiment_id"] = experiment_id
    with db_session() as session:
        rows = [
            dict(row)
            for row in session.execute(
                text(
                    f"""
                    SELECT mb.id AS binding_id, mb.target_id AS experiment_id, fe.code, fe.title AS experiment_title,
                           mb.title AS binding_title, mb.status AS binding_status, mb.published_at,
                           mb.metadata AS binding_metadata,
                           mb.metadata->>'point_key' AS point_key,
                           mb.metadata->>'point_title' AS point_title,
                           ma.id AS media_id, ma.title AS media_title, ma.original_file_name,
                           ma.mime_type, ma.file_size_bytes, ma.thumbnail_relative_path,
                           ma.upload_status, ma.error_reason,
                           ma.created_at, ma.updated_at
                    FROM media_bindings mb
                    JOIN media_assets ma ON ma.id = mb.media_asset_id
                    LEFT JOIN formal_experiments fe ON fe.id = mb.target_id
                    WHERE {" AND ".join(filters)}
                    ORDER BY mb.sort_order, ma.created_at DESC
                    """
                ),
                params,
            )
            .mappings()
            .all()
        ]
    for row in rows:
        row["title"] = row.get("binding_title") or row.get("media_title") or row.get("original_file_name")
        if not isinstance(row.get("binding_metadata"), dict):
            row["binding_metadata"] = {}
    return rows

def _current_experiment_catalog_count() -> int:
    with db_session() as session:
        return int(
            session.execute(
                text("SELECT COUNT(*) FROM formal_experiments WHERE status <> 'archived'")
            ).scalar_one()
            or 0
        )

def _replace_chapter_bindings(session: Any, experiment_id: str, bindings: list[ExperimentChapterBinding]) -> None:
    if not bindings:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one chapter binding is required")
    session.execute(text("DELETE FROM experiment_chapter_bindings WHERE experiment_id = :experiment_id"), {"experiment_id": experiment_id})
    for index, binding in enumerate(bindings):
        chapter = session.execute(text("SELECT id FROM chapters WHERE id = :chapter_id"), {"chapter_id": binding.chapter_id}).first()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Chapter not found: {binding.chapter_id}")
        session.execute(
            text(
                """
                INSERT INTO experiment_chapter_bindings (
                  experiment_id, chapter_id, coverage_type, notes, sort_order, updated_at
                )
                VALUES (
                  :experiment_id, :chapter_id, :coverage_type, :notes, :sort_order, now()
                )
                """
            ),
            {
                "experiment_id": experiment_id,
                "chapter_id": binding.chapter_id,
                "coverage_type": binding.coverage_type,
                "notes": binding.notes,
                "sort_order": binding.sort_order or index + 1,
            },
        )

def list_experiments_overview(
    *,
    chapter_id: str | None = None,
    status_filter: str | None = None,
    include_archived: bool = False,
    video_status: str | None = None,
    question_status: str | None = None,
) -> dict[str, Any]:
    items = _list_experiments(
        chapter_id=chapter_id,
        status_filter=status_filter,
        include_archived=include_archived,
        video_status=video_status,
        question_status=question_status,
    )
    return {
        "items": items,
        "total": len(items),
        "formal_count": _current_experiment_catalog_count(),
        "legacy_fragment_warning": "实验管理以精选目录中的具体实验点为主，不再以 19-1 到 20-3 的大实验单元计数。",
    }


def create_experiment(
    *,
    payload: ExperimentCreateRequest,
    user: Any,
) -> dict[str, Any]:
    bindings = _bindings_from_chapter_ids(payload.chapter_ids)
    if not bindings:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one chapter binding is required")
    with db_session() as session:
        experiment_id, code, display_order = _new_custom_experiment_identity(session)
        session.execute(
            text(
                """
                INSERT INTO formal_experiments (
                  id, code, title, title_en, summary, status, display_order,
                  source_refs, metadata, published_at, updated_at
                )
                VALUES (
                  :id, :code, :title, NULL, :summary, :status, :display_order,
                  '[]'::jsonb, CAST(:metadata AS jsonb),
                  CASE WHEN :status = 'published' THEN now() ELSE NULL END,
                  now()
                )
                """
            ),
            {
                "id": experiment_id,
                "code": code,
                "title": payload.title,
                "summary": payload.summary,
                "status": payload.status,
                "display_order": display_order,
                "metadata": _json({"custom": True, "created_by": user.id}),
            },
        )
        _replace_chapter_bindings(session, experiment_id, bindings)
    return get_experiment(experiment_id=experiment_id)


def get_experiment(
    *,
    experiment_id: str,
) -> dict[str, Any]:
    with db_session() as session:
        row = session.execute(text(_experiment_select_sql("WHERE fe.id = :experiment_id")), {"experiment_id": experiment_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formal experiment not found")
    return dict(row)


def update_experiment(
    *,
    payload: ExperimentUpdateRequest,
    experiment_id: str,
    user: Any,
) -> dict[str, Any]:
    data = _dump(payload)
    with db_session() as session:
        _ensure_experiment(session, experiment_id)
        session.execute(
            text(
                """
                UPDATE formal_experiments
                SET title = COALESCE(:title, title),
                    summary = COALESCE(:summary, summary),
                    status = COALESCE(:status, status),
                    published_at = CASE
                      WHEN :status = 'published' THEN COALESCE(published_at, now())
                      WHEN :status IS NULL THEN published_at
                      ELSE NULL
                    END,
                    updated_at = now()
                WHERE id = :experiment_id
                """
            ),
            {
                "experiment_id": experiment_id,
                "title": data.get("title"),
                "summary": data.get("summary"),
                "status": data.get("status"),
            },
        )
        if payload.chapter_ids is not None or payload.chapter_bindings is not None:
            _replace_chapter_bindings(
                session,
                experiment_id,
                _normalize_binding_payload(chapter_ids=payload.chapter_ids, chapter_bindings=payload.chapter_bindings),
            )
    return get_experiment(experiment_id=experiment_id)


def replace_experiment_chapter_bindings(
    *,
    bindings: list[Any],
    experiment_id: str,
    user: Any,
) -> dict[str, Any]:
    with db_session() as session:
        _ensure_experiment(session, experiment_id)
        _replace_chapter_bindings(session, experiment_id, _normalize_binding_payload(chapter_bindings=bindings))
    return get_experiment(experiment_id=experiment_id)


def upload_experiment_video(
    *,
    experiment_id: str,
    title: str,
    filename: str | None,
    content: bytes,
    content_type: str | None,
    user: Any,
) -> dict[str, Any]:
    with db_session() as session:
        _ensure_experiment(session, experiment_id)
    asset = create_media_asset(
        title=title,
        filename=filename or "upload.mp4",
        content=content,
        content_type=content_type,
        uploaded_by=user.id,
    )
    binding = create_media_binding(
        media_asset_id=str(asset["id"]),
        target_type="experiment",
        target_id=experiment_id,
        title=title,
        status="draft",
    )
    return {"asset": asset, "binding": binding}


def bind_existing_experiment_video(
    *,
    payload: ExperimentExistingVideoBindRequest,
    experiment_id: str,
    user: Any,
) -> dict[str, Any]:
    with db_session() as session:
        _ensure_experiment(session, experiment_id)
    return create_media_binding(
        media_asset_id=payload.media_asset_id,
        target_type="experiment",
        target_id=experiment_id,
        title=payload.title,
        status=payload.status,
        metadata={
            key: value
            for key, value in {
                "point_key": payload.point_key,
                "point_title": payload.point_title,
            }.items()
            if value
        },
    )


def get_experiment_video_points(
    *,
    experiment_id: str,
) -> dict[str, Any]:
    with db_session() as session:
        experiment = _ensure_experiment(session, experiment_id)
        return point_workspace_payload(session, experiment)


def add_experiment_video_point_resource(
    *,
    payload: ExperimentVideoPointResourceRequest,
    experiment_id: str,
    point_key: str,
    user: Any,
) -> dict[str, Any]:
    with db_session() as session:
        experiment = _ensure_experiment(session, experiment_id)
        ensure_canonical_points_for_experiment(session, experiment)
        point = ensure_active_point(session, experiment_id, point_key)
    return create_media_binding(
        media_asset_id=payload.media_asset_id,
        target_type="experiment",
        target_id=experiment_id,
        title=payload.title or point["point_title"],
        status=payload.status,
        metadata={
            "point_key": point["point_key"],
            "point_title": point["point_title"],
        },
    )


def list_experiment_videos(
    *,
    experiment_id: str | None = None,
) -> dict[str, Any]:
    rows = _list_experiment_video_resources(experiment_id)
    return {"items": rows, "total": len(rows)}
