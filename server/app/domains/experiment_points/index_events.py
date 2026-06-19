from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text


def _json(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False, default=str)


def _clean(value: Any) -> str:
    return str(value or "").strip()


def queue_index_state(
    session: Any,
    *,
    experiment_id: str,
    point_key: str,
    action: str,
    status_value: str = "pending",
    last_error: str | None = None,
) -> None:
    session.execute(
        text(
            """
            INSERT INTO experiment_video_point_search_index_state (
              experiment_id, point_key, document_id, desired_action, sync_status,
              attempts, last_error, updated_at
            )
            VALUES (
              :experiment_id, :point_key, :document_id, :desired_action, :sync_status,
              0, :last_error, now()
            )
            ON CONFLICT (experiment_id, point_key) DO UPDATE SET
              document_id = EXCLUDED.document_id,
              desired_action = EXCLUDED.desired_action,
              sync_status = EXCLUDED.sync_status,
              last_error = EXCLUDED.last_error,
              updated_at = now()
            """
        ),
        {
            "experiment_id": experiment_id,
            "point_key": point_key,
            "document_id": f"point:{experiment_id}:{point_key}",
            "desired_action": action,
            "sync_status": status_value,
            "last_error": last_error,
        },
    )


def queue_point_search_index_for_media_binding(session: Any, binding: dict[str, Any]) -> None:
    if binding.get("target_type") != "experiment":
        return
    metadata = binding.get("metadata") if isinstance(binding.get("metadata"), dict) else {}
    point_key = _clean(metadata.get("point_key"))
    experiment_id = _clean(binding.get("target_id"))
    if not experiment_id or not point_key:
        return
    row = (
        session.execute(
            text(
                """
                SELECT evp.status AS point_status,
                       fe.status AS experiment_status,
                       plc.content_status
                FROM experiment_video_points evp
                JOIN formal_experiments fe ON fe.id = evp.experiment_id
                LEFT JOIN experiment_point_learning_content plc
                  ON plc.experiment_id = evp.experiment_id
                 AND plc.point_key = evp.point_key
                WHERE evp.experiment_id = :experiment_id
                  AND evp.point_key = :point_key
                """
            ),
            {"experiment_id": experiment_id, "point_key": point_key},
        )
        .mappings()
        .first()
    )
    if not row:
        return
    should_upsert = (
        row.get("point_status") == "active"
        and row.get("experiment_status") == "published"
        and row.get("content_status") == "published"
    )
    queue_index_state(
        session,
        experiment_id=experiment_id,
        point_key=point_key,
        action="upsert" if should_upsert else "delete",
    )
