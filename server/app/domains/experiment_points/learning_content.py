from __future__ import annotations

import json
from typing import Any

from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from sqlalchemy import text

from server.app.infrastructure.database import db_session
from server.app.experiment_admin_schemas import (
    ExperimentPointLearningContentRequest,
    ExperimentPointPublicationRequest,
    ExperimentPointRelatedLinksRequest,
)
from server.app.domains.experiment_points.index_events import (
    queue_index_state,
    queue_point_search_index_for_media_binding,
)
from server.app.domains.experiment_points.canonical_points import candidate_point_key
from server.app.domains.experiment_points.related_links import merge_related_links


def _json(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False, default=str)


def _dump(model: Any) -> dict[str, Any]:
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _video_candidates(metadata: Any) -> list[str]:
    if not isinstance(metadata, dict):
        return []
    raw_candidates = metadata.get("video_candidates") or []
    if not isinstance(raw_candidates, list):
        return []
    candidates: list[str] = []
    seen: set[str] = set()
    for raw in raw_candidates:
        title = _clean(raw)
        if title and title not in seen:
            candidates.append(title)
            seen.add(title)
    return candidates


def _ensure_experiment(session: Any, experiment_id: str) -> dict[str, Any]:
    row = (
        session.execute(
            text(
                """
                SELECT fe.id, fe.code, fe.title, fe.title_en, fe.summary, fe.status,
                       fe.display_order, fe.source_refs, fe.metadata,
                       COALESCE((
                         SELECT jsonb_agg(
                           jsonb_build_object(
                             'chapter_id', ecb.chapter_id,
                             'coverage_type', ecb.coverage_type,
                             'sort_order', ecb.sort_order
                           )
                           ORDER BY ecb.sort_order, ecb.chapter_id
                         )
                         FROM experiment_chapter_bindings ecb
                         WHERE ecb.experiment_id = fe.id
                       ), '[]'::jsonb) AS chapter_bindings
                FROM formal_experiments fe
                WHERE fe.id = :experiment_id
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


def _ensure_point(session: Any, experiment_id: str, point_key: str) -> dict[str, Any]:
    row = (
        session.execute(
            text(
                """
                SELECT experiment_id, point_key, point_title, display_order, source, status, metadata
                FROM experiment_video_points
                WHERE experiment_id = :experiment_id
                  AND point_key = :point_key
                """
            ),
            {"experiment_id": experiment_id, "point_key": point_key},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment point not found")
    point = dict(row)
    if point.get("status") == "archived":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Experiment point is archived")
    return point


def ensure_active_point(session: Any, experiment_id: str, point_key: str) -> dict[str, Any]:
    return _ensure_point(session, experiment_id, point_key)


def _list_video_resources(session: Any, experiment_id: str) -> list[dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                SELECT mb.id AS binding_id,
                       mb.target_id AS experiment_id,
                       fe.title AS experiment_title,
                       mb.title AS binding_title,
                       mb.status AS binding_status,
                       mb.published_at,
                       mb.metadata AS binding_metadata,
                       mb.metadata->>'point_key' AS point_key,
                       mb.metadata->>'point_title' AS point_title,
                       ma.id AS media_id,
                       ma.title AS media_title,
                       ma.original_file_name,
                       ma.mime_type,
                       ma.file_size_bytes,
                       ma.thumbnail_relative_path,
                       ma.upload_status,
                       ma.error_reason,
                       ma.created_at,
                       ma.updated_at
                FROM media_bindings mb
                JOIN media_assets ma ON ma.id = mb.media_asset_id
                LEFT JOIN formal_experiments fe ON fe.id = mb.target_id
                WHERE mb.target_type = 'experiment'
                  AND mb.target_id = :experiment_id
                  AND mb.status <> 'archived'
                ORDER BY mb.sort_order, mb.created_at
                """
            ),
            {"experiment_id": experiment_id},
        )
        .mappings()
        .all()
    )
    resources: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["title"] = item.get("binding_title") or item.get("media_title") or item.get("original_file_name")
        if not isinstance(item.get("binding_metadata"), dict):
            item["binding_metadata"] = {}
        resources.append(item)
    return resources


def ensure_canonical_points_for_experiment(session: Any, experiment: dict[str, Any]) -> None:
    experiment_id = str(experiment["id"])
    for index, title in enumerate(_video_candidates(experiment.get("metadata"))):
        point_key = candidate_point_key(index, title)
        session.execute(
            text(
                """
                INSERT INTO experiment_video_points (
                  experiment_id, point_key, point_title, display_order, source, status, metadata, updated_at
                )
                VALUES (
                  :experiment_id, :point_key, :point_title, :display_order, 'seed_candidate',
                  'active', CAST(:metadata AS jsonb), now()
                )
                ON CONFLICT (experiment_id, point_key) DO UPDATE SET
                  point_title = EXCLUDED.point_title,
                  display_order = LEAST(experiment_video_points.display_order, EXCLUDED.display_order),
                  updated_at = now()
                """
            ),
            {
                "experiment_id": experiment_id,
                "point_key": point_key,
                "point_title": title,
                "display_order": index + 1,
                "metadata": _json({"source": "formal_experiments.metadata.video_candidates"}),
            },
        )
    for index, resource in enumerate(_list_video_resources(session, experiment_id)):
        point_key = _clean(resource.get("point_key"))
        point_title = _clean(resource.get("point_title"))
        if not point_key and not point_title:
            continue
        if not point_key:
            point_key = f"media-{_clean(resource.get('binding_id'))[:8]}"
        if not point_title:
            point_title = _clean(resource.get("title")) or point_key
        session.execute(
            text(
                """
                INSERT INTO experiment_video_points (
                  experiment_id, point_key, point_title, display_order, source, status, metadata, updated_at
                )
                VALUES (
                  :experiment_id, :point_key, :point_title, :display_order, 'media_binding',
                  'active', CAST(:metadata AS jsonb), now()
                )
                ON CONFLICT (experiment_id, point_key) DO UPDATE SET
                  point_title = COALESCE(NULLIF(experiment_video_points.point_title, ''), EXCLUDED.point_title),
                  display_order = LEAST(experiment_video_points.display_order, EXCLUDED.display_order),
                  metadata = experiment_video_points.metadata || EXCLUDED.metadata,
                  updated_at = now()
                """
            ),
            {
                "experiment_id": experiment_id,
                "point_key": point_key,
                "point_title": point_title,
                "display_order": 10000 + index,
                "metadata": _json({"source": "media_bindings.metadata", "binding_id": _clean(resource.get("binding_id"))}),
            },
        )


def _list_points(session: Any, experiment_id: str) -> list[dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                SELECT experiment_id, point_key, point_title, display_order, source, status, metadata, created_at, updated_at
                FROM experiment_video_points
                WHERE experiment_id = :experiment_id
                  AND status <> 'archived'
                ORDER BY display_order, point_key
                """
            ),
            {"experiment_id": experiment_id},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def _content_rows(session: Any, experiment_id: str) -> dict[str, dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                SELECT experiment_id, point_key, principle_mode, principle_equation, principle_text,
                       phenomenon_explanation, safety_note, content_status, published_at,
                       published_by, created_by, updated_by, metadata, created_at, updated_at
                FROM experiment_point_learning_content
                WHERE experiment_id = :experiment_id
                """
            ),
            {"experiment_id": experiment_id},
        )
        .mappings()
        .all()
    )
    return {str(row["point_key"]): dict(row) for row in rows}


def _index_state_rows(session: Any, experiment_id: str) -> dict[str, dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                SELECT experiment_id, point_key, document_id, desired_action, sync_status, attempts,
                       document_hash, last_error, indexed_at, last_attempted_at, created_at, updated_at
                FROM experiment_video_point_search_index_state
                WHERE experiment_id = :experiment_id
                """
            ),
            {"experiment_id": experiment_id},
        )
        .mappings()
        .all()
    )
    return {str(row["point_key"]): dict(row) for row in rows}


def _manual_link_rows(session: Any, experiment_id: str) -> dict[str, list[dict[str, Any]]]:
    rows = (
        session.execute(
            text(
                """
                SELECT l.id, l.source_experiment_id, l.source_point_key, l.target_experiment_id,
                       l.target_point_key, l.relation_type, l.hidden, l.sort_order, l.label,
                       l.metadata, l.created_at, l.updated_at,
                       tp.point_title AS target_point_title,
                       te.title AS target_experiment_title
                FROM experiment_point_related_links l
                JOIN experiment_video_points tp
                  ON tp.experiment_id = l.target_experiment_id
                 AND tp.point_key = l.target_point_key
                JOIN formal_experiments te ON te.id = l.target_experiment_id
                WHERE l.source_experiment_id = :experiment_id
                ORDER BY l.source_point_key, l.sort_order, l.created_at
                """
            ),
            {"experiment_id": experiment_id},
        )
        .mappings()
        .all()
    )
    by_source: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_source.setdefault(str(row["source_point_key"]), []).append(dict(row))
    return by_source


def _content_payload(content: dict[str, Any] | None) -> dict[str, Any]:
    if not content:
        return {
            "principle_mode": "text",
            "principle_equation": "",
            "principle_text": "",
            "phenomenon_explanation": "",
            "safety_note": "",
            "content_status": "missing",
            "published_at": None,
            "metadata": {},
        }
    return {
        "principle_mode": content.get("principle_mode") or "text",
        "principle_equation": content.get("principle_equation") or "",
        "principle_text": content.get("principle_text") or "",
        "phenomenon_explanation": content.get("phenomenon_explanation") or "",
        "safety_note": content.get("safety_note") or "",
        "content_status": content.get("content_status") or "draft",
        "published_at": content.get("published_at"),
        "published_by": str(content.get("published_by")) if content.get("published_by") else None,
        "updated_by": str(content.get("updated_by")) if content.get("updated_by") else None,
        "metadata": content.get("metadata") if isinstance(content.get("metadata"), dict) else {},
        "updated_at": content.get("updated_at"),
    }


def validate_point_content(content: dict[str, Any] | None, *, experiment_status: str = "published") -> dict[str, Any]:
    payload = _content_payload(content)
    errors: list[str] = []
    warnings: list[str] = []
    mode = payload["principle_mode"]
    equation = _clean(payload.get("principle_equation"))
    principle_text = _clean(payload.get("principle_text"))
    if mode == "equation":
        if not equation:
            errors.append("Equation-mode principle is required before publishing")
        if principle_text:
            errors.append("Equation mode cannot use principle text as the primary principle")
    elif mode == "text":
        if not principle_text:
            errors.append("Text-mode principle is required before publishing")
        if equation:
            errors.append("Text mode cannot use principle equation as the primary principle")
    else:
        errors.append("Principle mode must be equation or text")
    if not _clean(payload.get("phenomenon_explanation")):
        errors.append("Phenomenon explanation is required before publishing")
    if not _clean(payload.get("safety_note")):
        errors.append("Safety note is required before publishing")
    if experiment_status != "published":
        errors.append("Parent experiment must be published before point content is published")
    if payload.get("content_status") in {"missing", "draft"}:
        warnings.append("Point content is not published yet")
    return {
        "complete": not errors,
        "errors": errors,
        "warnings": warnings,
    }


def _resource_bucket(resources: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    for resource in resources:
        point_key = _clean(resource.get("point_key"))
        if not point_key:
            continue
        buckets.setdefault(point_key, []).append(resource)
    return buckets


def _index_state_payload(state: dict[str, Any] | None, *, point_key: str, experiment_id: str) -> dict[str, Any]:
    if not state:
        return {
            "document_id": f"point:{experiment_id}:{point_key}",
            "desired_action": "upsert",
            "sync_status": "pending",
            "attempts": 0,
            "last_error": None,
            "indexed_at": None,
            "updated_at": None,
        }
    return {
        "document_id": state.get("document_id"),
        "desired_action": state.get("desired_action"),
        "sync_status": state.get("sync_status"),
        "attempts": int(state.get("attempts") or 0),
        "last_error": state.get("last_error"),
        "indexed_at": state.get("indexed_at"),
        "updated_at": state.get("updated_at"),
    }


def _serialize_resource(resource: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in resource.items()
        if key not in {"binding_metadata"}
    }


def point_workspace_payload(session: Any, experiment: dict[str, Any]) -> dict[str, Any]:
    ensure_canonical_points_for_experiment(session, experiment)
    experiment_id = str(experiment["id"])
    points = _list_points(session, experiment_id)
    resources = _list_video_resources(session, experiment_id)
    resources_by_point = _resource_bucket(resources)
    content_by_key = _content_rows(session, experiment_id)
    index_state_by_key = _index_state_rows(session, experiment_id)
    manual_links_by_key = _manual_link_rows(session, experiment_id)
    point_items: list[dict[str, Any]] = []
    for point in points:
        point_key = str(point["point_key"])
        point_resources = resources_by_point.get(point_key, [])
        content = content_by_key.get(point_key)
        validation = validate_point_content(content, experiment_status=str(experiment.get("status") or "draft"))
        related_links = merge_related_links(
            points=points,
            point_key=point_key,
            manual_links=manual_links_by_key.get(point_key, []),
            include_hidden=True,
        )
        published_count = len([resource for resource in point_resources if resource.get("binding_status") == "published"])
        point_items.append(
            {
                "point_key": point_key,
                "point_title": point["point_title"],
                "display_order": point["display_order"],
                "source": point["source"],
                "status": point["status"],
                "metadata": point.get("metadata") if isinstance(point.get("metadata"), dict) else {},
                "resources": [_serialize_resource(resource) for resource in point_resources],
                "resource_count": len(point_resources),
                "published_count": published_count,
                "content": _content_payload(content),
                "validation": validation,
                "related_links": related_links,
                "related_link_count": len([link for link in related_links if not link.get("hidden")]),
                "index_state": _index_state_payload(index_state_by_key.get(point_key), point_key=point_key, experiment_id=experiment_id),
            }
        )
    return {
        "experiment": {
            "id": experiment["id"],
            "code": experiment["code"],
            "title": experiment["title"],
            "status": experiment["status"],
        },
        "points": point_items,
        "total_points": len(point_items),
        "total_resources": sum(len(point["resources"]) for point in point_items),
        "published_resources": sum(int(point["published_count"]) for point in point_items),
    }


def list_experiment_point_workspace(*, experiment_id: str) -> dict[str, Any]:
    with db_session() as session:
        experiment = _ensure_experiment(session, experiment_id)
        return point_workspace_payload(session, experiment)


def save_point_learning_content(
    *,
    payload: ExperimentPointLearningContentRequest,
    experiment_id: str,
    point_key: str,
    user: Any,
) -> dict[str, Any]:
    data = _dump(payload)
    principle_mode = _clean(data.get("principle_mode") or "text")
    principle_equation = _clean(data.get("principle_equation"))
    principle_text = _clean(data.get("principle_text"))
    if principle_mode == "equation":
        principle_text = ""
    elif principle_mode == "text":
        principle_equation = ""
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Principle mode must be equation or text")
    with db_session() as session:
        experiment = _ensure_experiment(session, experiment_id)
        ensure_canonical_points_for_experiment(session, experiment)
        _ensure_point(session, experiment_id, point_key)
        point_title = _clean(data.get("point_title"))
        if point_title:
            session.execute(
                text(
                    """
                    UPDATE experiment_video_points
                    SET point_title = :point_title, source = CASE WHEN source = 'seed_candidate' THEN 'manual' ELSE source END, updated_at = now()
                    WHERE experiment_id = :experiment_id AND point_key = :point_key
                    """
                ),
                {"experiment_id": experiment_id, "point_key": point_key, "point_title": point_title},
            )
        session.execute(
            text(
                """
                INSERT INTO experiment_point_learning_content (
                  experiment_id, point_key, principle_mode, principle_equation, principle_text,
                  phenomenon_explanation, safety_note, content_status, created_by, updated_by,
                  metadata, updated_at
                )
                VALUES (
                  :experiment_id, :point_key, :principle_mode, :principle_equation, :principle_text,
                  :phenomenon_explanation, :safety_note, 'draft', CAST(:user_id AS uuid), CAST(:user_id AS uuid),
                  CAST(:metadata AS jsonb), now()
                )
                ON CONFLICT (experiment_id, point_key) DO UPDATE SET
                  principle_mode = EXCLUDED.principle_mode,
                  principle_equation = EXCLUDED.principle_equation,
                  principle_text = EXCLUDED.principle_text,
                  phenomenon_explanation = EXCLUDED.phenomenon_explanation,
                  safety_note = EXCLUDED.safety_note,
                  content_status = 'draft',
                  updated_by = EXCLUDED.updated_by,
                  metadata = experiment_point_learning_content.metadata || EXCLUDED.metadata,
                  updated_at = now()
                """
            ),
            {
                "experiment_id": experiment_id,
                "point_key": point_key,
                "principle_mode": principle_mode,
                "principle_equation": principle_equation or None,
                "principle_text": principle_text or None,
                "phenomenon_explanation": _clean(data.get("phenomenon_explanation")),
                "safety_note": _clean(data.get("safety_note")),
                "user_id": user.id,
                "metadata": _json(data.get("metadata") if isinstance(data.get("metadata"), dict) else {}),
            },
        )
        queue_index_state(session, experiment_id=experiment_id, point_key=point_key, action="delete", status_value="pending")
        return point_workspace_payload(session, experiment)


def set_point_publication_status(
    *,
    payload: ExperimentPointPublicationRequest,
    experiment_id: str,
    point_key: str,
    user: Any,
) -> dict[str, Any]:
    action = payload.action
    with db_session() as session:
        experiment = _ensure_experiment(session, experiment_id)
        ensure_canonical_points_for_experiment(session, experiment)
        _ensure_point(session, experiment_id, point_key)
        content = _content_rows(session, experiment_id).get(point_key)
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Point content must be saved before publication changes")
        if action == "publish":
            validation = validate_point_content(content, experiment_status=str(experiment.get("status") or "draft"))
            if validation["errors"]:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=validation["errors"])
            session.execute(
                text(
                    """
                    UPDATE experiment_point_learning_content
                    SET content_status = 'published',
                        published_at = now(),
                        published_by = CAST(:user_id AS uuid),
                        updated_by = CAST(:user_id AS uuid),
                        updated_at = now()
                    WHERE experiment_id = :experiment_id AND point_key = :point_key
                    """
                ),
                {"experiment_id": experiment_id, "point_key": point_key, "user_id": user.id},
            )
            queue_index_state(session, experiment_id=experiment_id, point_key=point_key, action="upsert")
        elif action in {"unpublish", "archive"}:
            status_value = "archived" if action == "archive" else "draft"
            session.execute(
                text(
                    """
                    UPDATE experiment_point_learning_content
                    SET content_status = :content_status,
                        updated_by = CAST(:user_id AS uuid),
                        updated_at = now()
                    WHERE experiment_id = :experiment_id AND point_key = :point_key
                    """
                ),
                {
                    "experiment_id": experiment_id,
                    "point_key": point_key,
                    "user_id": user.id,
                    "content_status": status_value,
                },
            )
            queue_index_state(session, experiment_id=experiment_id, point_key=point_key, action="delete")
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported publication action")
        return point_workspace_payload(session, experiment)


def replace_point_related_links(
    *,
    payload: ExperimentPointRelatedLinksRequest,
    experiment_id: str,
    point_key: str,
    user: Any,
) -> dict[str, Any]:
    links = _dump(payload).get("links") or []
    with db_session() as session:
        experiment = _ensure_experiment(session, experiment_id)
        ensure_canonical_points_for_experiment(session, experiment)
        _ensure_point(session, experiment_id, point_key)
        for link in links:
            target_experiment_id = _clean(link.get("target_experiment_id"))
            target_point_key = _clean(link.get("target_point_key"))
            target_experiment = _ensure_experiment(session, target_experiment_id)
            ensure_canonical_points_for_experiment(session, target_experiment)
            _ensure_point(session, target_experiment_id, target_point_key)
        session.execute(
            text(
                """
                DELETE FROM experiment_point_related_links
                WHERE source_experiment_id = :experiment_id AND source_point_key = :point_key
                """
            ),
            {"experiment_id": experiment_id, "point_key": point_key},
        )
        for index, link in enumerate(links):
            session.execute(
                text(
                    """
                    INSERT INTO experiment_point_related_links (
                      source_experiment_id, source_point_key, target_experiment_id, target_point_key,
                      relation_type, hidden, sort_order, label, metadata, created_by, updated_by, updated_at
                    )
                    VALUES (
                      :source_experiment_id, :source_point_key, :target_experiment_id, :target_point_key,
                      :relation_type, :hidden, :sort_order, :label, CAST(:metadata AS jsonb),
                      CAST(:user_id AS uuid), CAST(:user_id AS uuid), now()
                    )
                    """
                ),
                {
                    "source_experiment_id": experiment_id,
                    "source_point_key": point_key,
                    "target_experiment_id": _clean(link.get("target_experiment_id")),
                    "target_point_key": _clean(link.get("target_point_key")),
                    "relation_type": _clean(link.get("relation_type")) or "manual",
                    "hidden": bool(link.get("hidden")),
                    "sort_order": int(link.get("sort_order") or index + 1),
                    "label": _clean(link.get("label")) or None,
                    "metadata": _json(link.get("metadata") if isinstance(link.get("metadata"), dict) else {}),
                    "user_id": user.id,
                },
            )
        content = _content_rows(session, experiment_id).get(point_key)
        queue_index_state(
            session,
            experiment_id=experiment_id,
            point_key=point_key,
            action="upsert" if content and content.get("content_status") == "published" else "delete",
        )
        return point_workspace_payload(session, experiment)


def student_point_content_payload(
    session: Any,
    *,
    experiment_id: str,
    point_key: str | None,
) -> dict[str, Any]:
    experiment = _ensure_experiment(session, experiment_id)
    ensure_canonical_points_for_experiment(session, experiment)
    points = _list_points(session, experiment_id)
    if not points:
        return {
            "selected_point_key": point_key,
            "selected_point_title": None,
            "point_content_status": "missing",
            "principle_mode": "text",
            "principle_equation": None,
            "principle_text": None,
            "phenomenon_explanation": None,
            "safety_note": None,
            "related_points": [],
            "assessment_context": _assessment_context(experiment),
        }
    selected = next((point for point in points if point["point_key"] == point_key), None)
    if selected is None:
        selected = points[0]
    selected_key = str(selected["point_key"])
    content = _content_rows(session, experiment_id).get(selected_key)
    public_content = content if content and content.get("content_status") == "published" else None
    manual_links = _manual_link_rows(session, experiment_id).get(selected_key, [])
    related_links = merge_related_links(
        points=points,
        point_key=selected_key,
        manual_links=manual_links,
        include_hidden=False,
    )
    payload = _content_payload(public_content)
    return {
        "selected_point_key": selected_key,
        "selected_point_title": selected.get("point_title"),
        "point_content_status": payload.get("content_status") if public_content else (content.get("content_status") if content else "missing"),
        "principle_mode": payload.get("principle_mode"),
        "principle_equation": payload.get("principle_equation") or None,
        "principle_text": payload.get("principle_text") or None,
        "phenomenon_explanation": payload.get("phenomenon_explanation") or None,
        "safety_note": payload.get("safety_note") or None,
        "related_points": [
            {
                "experiment_id": link["target_experiment_id"],
                "point_key": link["target_point_key"],
                "point_title": link.get("label") or link.get("target_point_title") or link["target_point_key"],
                "experiment_title": link.get("target_experiment_title") or experiment.get("title"),
                "relation_type": link.get("relation_type") or link.get("source"),
            }
            for link in related_links
            if not link.get("hidden")
        ],
        "assessment_context": _assessment_context(experiment),
    }


def _assessment_context(experiment: dict[str, Any]) -> dict[str, Any]:
    metadata = experiment.get("metadata") if isinstance(experiment.get("metadata"), dict) else {}
    return {
        "experiment_id": experiment.get("id"),
        "chapter_ids": [
            _clean(binding.get("chapter_id"))
            for binding in experiment.get("chapter_bindings", []) or []
            if isinstance(binding, dict) and _clean(binding.get("chapter_id"))
        ],
        "parent_code": metadata.get("parent_code") or experiment.get("code"),
        "parent_title": metadata.get("parent_title") or experiment.get("title"),
    }

