from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import text

from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from server.app.infrastructure.database import db_session
from server.app.student_video_save_schemas import (
    StudentVideoPersonalState,
    StudentVideoSaveRequest,
    StudentVideoSaveResponse,
    StudentVideoSaveType,
)


SAVE_TYPES: set[str] = {"watch_later", "favorite"}


def normalize_save_type(save_type: str) -> StudentVideoSaveType:
    normalized = str(save_type or "").strip().lower().replace("-", "_")
    if normalized not in SAVE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported video save type")
    return normalized  # type: ignore[return-value]


def student_user_id(user: Any) -> str:
    return str(getattr(user, "id", "") or "").strip()


def _format_dt(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _state_from_rows(rows: list[dict[str, Any]]) -> StudentVideoPersonalState:
    state = StudentVideoPersonalState()
    for row in rows:
        save_type = str(row.get("save_type") or "")
        saved_at = _format_dt(row.get("updated_at") or row.get("created_at"))
        if save_type == "watch_later":
            state.watch_later = True
            state.watch_later_saved_at = saved_at
        elif save_type == "favorite":
            state.favorite = True
            state.favorite_saved_at = saved_at
    return state


def _save_key(placement_node_id: str, media_id: str) -> str:
    return f"{placement_node_id}:{media_id}"


def personal_states_for_items(
    session: Any,
    user: Any,
    items: list[tuple[str, str]],
) -> dict[str, StudentVideoPersonalState]:
    user_id = student_user_id(user)
    if not user_id or not items:
        return {_save_key(placement, media): StudentVideoPersonalState() for placement, media in items}
    if not hasattr(session, "execute"):
        return {_save_key(placement, media): StudentVideoPersonalState() for placement, media in items}
    values = [
        {"placement_node_id": str(placement), "media_id": str(media)}
        for placement, media in items
        if str(placement).strip() and str(media).strip()
    ]
    if not values:
        return {}
    rows = (
        session.execute(
            text(
                """
                WITH requested(placement_node_id, media_asset_id) AS (
                  SELECT placement_node_id, CAST(media_id AS uuid)
                  FROM jsonb_to_recordset(CAST(:items AS jsonb))
                    AS item(placement_node_id text, media_id text)
                )
                SELECT
                  svs.placement_node_id,
                  svs.media_asset_id,
                  svs.save_type,
                  svs.created_at,
                  svs.updated_at
                FROM student_video_saves svs
                JOIN requested r
                  ON r.placement_node_id = svs.placement_node_id
                 AND r.media_asset_id = svs.media_asset_id
                WHERE svs.student_id = CAST(:student_id AS uuid)
                  AND svs.archived_at IS NULL
                  AND svs.save_type IN ('watch_later', 'favorite')
                """
            ),
            {"student_id": user_id, "items": json.dumps(values, ensure_ascii=False)},
        )
        .mappings()
        .all()
    )
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        key = _save_key(str(row["placement_node_id"]), str(row["media_asset_id"]))
        grouped.setdefault(key, []).append(dict(row))
    return {
        _save_key(placement, media): _state_from_rows(grouped.get(_save_key(placement, media), []))
        for placement, media in items
    }


def personal_state_for_item(session: Any, user: Any, *, placement_node_id: str, media_id: str) -> StudentVideoPersonalState:
    return personal_states_for_items(session, user, [(placement_node_id, media_id)]).get(
        _save_key(placement_node_id, media_id),
        StudentVideoPersonalState(),
    )


def _visible_point_media(session: Any, *, placement_node_id: str, media_id: str) -> dict[str, Any]:
    row = (
        session.execute(
            text(
                """
                SELECT
                  n.id AS placement_node_id,
                  COALESCE(n.canonical_point_id, n.id) AS canonical_point_id,
                  mb.media_asset_id
                FROM experiment_catalog_nodes n
                JOIN experiment_catalog_points cp ON cp.id = n.canonical_point_id
                JOIN experiment_catalog_point_media_bindings mb
                  ON ((n.canonical_point_id IS NOT NULL AND mb.canonical_point_id = n.canonical_point_id)
                   OR mb.node_id = n.id)
                JOIN media_assets ma ON ma.id = mb.media_asset_id
                WHERE n.id = :placement_node_id
                  AND n.node_kind = 'point'
                  AND n.status = 'published'
                  AND cp.status = 'published'
                  AND mb.media_asset_id = CAST(:media_id AS uuid)
                  AND mb.binding_status = 'published'
                  AND ma.upload_status = 'ready'
                  AND COALESCE(ma.lifecycle_status, 'active') = 'active'
                  AND (
                    WITH RECURSIVE path AS (
                      SELECT id, parent_id, status
                      FROM experiment_catalog_nodes
                      WHERE id = n.id
                      UNION ALL
                      SELECT parent.id, parent.parent_id, parent.status
                      FROM experiment_catalog_nodes parent
                      JOIN path ON path.parent_id = parent.id
                    )
                    SELECT COALESCE(bool_and(status = 'published'), false)
                    FROM path
                  )
                LIMIT 1
                """
            ),
            {"placement_node_id": placement_node_id, "media_id": media_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video item not available")
    return dict(row)


def set_student_video_save(
    user: Any,
    *,
    save_type: str,
    payload: StudentVideoSaveRequest,
    active: bool,
) -> StudentVideoSaveResponse:
    normalized_type = normalize_save_type(save_type)
    user_id = student_user_id(user)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Student user required")
    with db_session() as session:
        visible = _visible_point_media(session, placement_node_id=payload.placement_node_id, media_id=payload.media_id)
        params = {
            "student_id": user_id,
            "save_type": normalized_type,
            "placement_node_id": visible["placement_node_id"],
            "canonical_point_id": payload.canonical_point_id or visible["canonical_point_id"],
            "media_id": str(visible["media_asset_id"]),
            "source": payload.source or "unknown",
        }
        if active:
            session.execute(
                text(
                    """
                    INSERT INTO student_video_saves (
                      student_id, save_type, placement_node_id, canonical_point_id, media_asset_id,
                      source, archived_at, created_at, updated_at
                    )
                    VALUES (
                      CAST(:student_id AS uuid), :save_type, :placement_node_id, :canonical_point_id,
                      CAST(:media_id AS uuid), :source, NULL, now(), now()
                    )
                    ON CONFLICT (student_id, save_type, placement_node_id, media_asset_id)
                    DO UPDATE SET
                      canonical_point_id = EXCLUDED.canonical_point_id,
                      source = EXCLUDED.source,
                      archived_at = NULL,
                      updated_at = now()
                    """
                ),
                params,
            )
        else:
            session.execute(
                text(
                    """
                    UPDATE student_video_saves
                    SET archived_at = COALESCE(archived_at, now()),
                        updated_at = now()
                    WHERE student_id = CAST(:student_id AS uuid)
                      AND save_type = :save_type
                      AND placement_node_id = :placement_node_id
                      AND media_asset_id = CAST(:media_id AS uuid)
                    """
                ),
                params,
            )
        state = personal_state_for_item(
            session,
            user,
            placement_node_id=str(visible["placement_node_id"]),
            media_id=str(visible["media_asset_id"]),
        )
    return StudentVideoSaveResponse(
        save_type=normalized_type,
        placement_node_id=str(visible["placement_node_id"]),
        canonical_point_id=str(visible["canonical_point_id"]),
        media_id=str(visible["media_asset_id"]),
        active=active,
        personal_state=state,
    )
