from __future__ import annotations

from typing import Any

from sqlalchemy import text

from server.app.catalog_tree_schemas import CatalogPointMediaBindRequest
from server.app.domains.catalog_tree.common import clean, dump_model, get_node, json_dump, point_capable
from server.app.domains.catalog_tree.search_documents import queue_index_state
from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from server.app.infrastructure.database import db_session


def media_bindings(session: Any, node_id: str) -> list[dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                SELECT mb.id AS binding_id,
                       mb.node_id,
                       mb.media_asset_id AS media_id,
                       COALESCE(mb.title, ma.title, ma.original_file_name) AS title,
                       mb.binding_status,
                       mb.display_order,
                       mb.published_at,
                       mb.metadata,
                       ma.original_file_name,
                       ma.mime_type,
                       COALESCE(ma.playback_mime_type, ma.mime_type) AS playback_mime_type,
                       ma.upload_status,
                       ma.processing_phase,
                       ma.processing_progress,
                       ma.error_reason,
                       ma.thumbnail_relative_path IS NOT NULL AS has_thumbnail,
                       ma.created_at,
                       ma.updated_at
                FROM experiment_catalog_point_media_bindings mb
                JOIN media_assets ma ON ma.id = mb.media_asset_id
                WHERE mb.node_id = :node_id
                  AND mb.binding_status <> 'archived'
                ORDER BY mb.display_order, mb.created_at
                """
            ),
            {"node_id": node_id},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def student_videos(session: Any, node_id: str) -> list[dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                SELECT ma.id AS media_id,
                       COALESCE(mb.title, ma.title, ma.original_file_name) AS title,
                       COALESCE(ma.playback_mime_type, ma.mime_type) AS mime_type,
                       ma.thumbnail_relative_path IS NOT NULL AS has_thumbnail
                FROM experiment_catalog_point_media_bindings mb
                JOIN media_assets ma ON ma.id = mb.media_asset_id
                WHERE mb.node_id = :node_id
                  AND mb.binding_status = 'published'
                  AND ma.upload_status = 'ready'
                ORDER BY mb.display_order, mb.created_at
                """
            ),
            {"node_id": node_id},
        )
        .mappings()
        .all()
    )
    return [
        {
            "media_id": str(row["media_id"]),
            "title": row["title"],
            "mime_type": row["mime_type"],
            "stream_path": f"/api/student/media/assets/{row['media_id']}/stream",
            "thumbnail_path": f"/api/student/media/assets/{row['media_id']}/thumbnail" if row["has_thumbnail"] else None,
        }
        for row in rows
    ]


def bind_existing_media(*, node_id: str, payload: CatalogPointMediaBindRequest, user: Any) -> dict[str, Any]:
    data = dump_model(payload)
    with db_session() as session:
        node = get_node(session, node_id)
        if not point_capable(node):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Directory nodes cannot bind videos")
        asset_exists = session.execute(
            text("SELECT 1 FROM media_assets WHERE id = CAST(:asset_id AS uuid)"),
            {"asset_id": clean(data.get("media_asset_id"))},
        ).first()
        if not asset_exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found")
        row = session.execute(
            text(
                """
                INSERT INTO experiment_catalog_point_media_bindings (
                  node_id, media_asset_id, title, binding_status, display_order,
                  metadata, created_by, updated_by, published_by, published_at, updated_at
                )
                VALUES (
                  :node_id, CAST(:media_asset_id AS uuid), :title, :binding_status,
                  (
                    SELECT COALESCE(MAX(display_order), 0) + 1
                    FROM experiment_catalog_point_media_bindings
                    WHERE node_id = :node_id
                  ),
                  CAST(:metadata AS jsonb), CAST(:user_id AS uuid), CAST(:user_id AS uuid),
                  CASE WHEN :binding_status = 'published' THEN CAST(:user_id AS uuid) ELSE NULL END,
                  CASE WHEN :binding_status = 'published' THEN now() ELSE NULL END,
                  now()
                )
                ON CONFLICT (node_id, media_asset_id) DO UPDATE SET
                  title = EXCLUDED.title,
                  binding_status = EXCLUDED.binding_status,
                  metadata = experiment_catalog_point_media_bindings.metadata || EXCLUDED.metadata,
                  updated_by = EXCLUDED.updated_by,
                  published_by = EXCLUDED.published_by,
                  published_at = EXCLUDED.published_at,
                  updated_at = now()
                RETURNING id
                """
            ),
            {
                "node_id": node_id,
                "media_asset_id": clean(data.get("media_asset_id")),
                "title": clean(data.get("title")) or None,
                "binding_status": clean(data.get("status") or "draft"),
                "metadata": json_dump(data.get("metadata") if isinstance(data.get("metadata"), dict) else {}),
                "user_id": user.id,
            },
        ).mappings().one()
        queue_index_state(session, node_id=node_id, action="upsert" if node["status"] == "published" else "delete")
    from server.app.domains.catalog_tree.nodes import get_node_detail

    return {"binding_id": str(row["id"]), "detail": get_node_detail(node_id=node_id)}


def set_media_binding_status(*, binding_id: str, action: str, user: Any) -> dict[str, Any]:
    if action not in {"publish", "unpublish", "delete"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported media binding action")
    with db_session() as session:
        row = session.execute(
            text(
                """
                SELECT id, node_id
                FROM experiment_catalog_point_media_bindings
                WHERE id = CAST(:binding_id AS uuid)
                """
            ),
            {"binding_id": binding_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media binding not found")
        node_id = str(row["node_id"])
        if action == "delete":
            session.execute(
                text(
                    """
                    UPDATE experiment_catalog_point_media_bindings
                    SET binding_status = 'archived',
                        updated_by = CAST(:user_id AS uuid),
                        updated_at = now()
                    WHERE id = CAST(:binding_id AS uuid)
                    """
                ),
                {"binding_id": binding_id, "user_id": user.id},
            )
        else:
            status_value = "published" if action == "publish" else "draft"
            session.execute(
                text(
                    """
                    UPDATE experiment_catalog_point_media_bindings
                    SET binding_status = :status,
                        published_by = CASE WHEN :status = 'published' THEN CAST(:user_id AS uuid) ELSE NULL END,
                        published_at = CASE WHEN :status = 'published' THEN now() ELSE NULL END,
                        updated_by = CAST(:user_id AS uuid),
                        updated_at = now()
                    WHERE id = CAST(:binding_id AS uuid)
                    """
                ),
                {"binding_id": binding_id, "status": status_value, "user_id": user.id},
            )
        queue_index_state(session, node_id=node_id, action="upsert")
    from server.app.domains.catalog_tree.nodes import get_node_detail

    return get_node_detail(node_id=node_id)
