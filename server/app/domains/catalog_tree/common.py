from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text

from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from server.app.domains.catalog_tree.equations import list_reaction_equations, reaction_principle_text


NODE_KINDS = {"directory", "point"}
POINT_KINDS = {"point"}


def json_dump(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False, default=str)


def dump_model(model: Any) -> dict[str, Any]:
    return model.model_dump() if hasattr(model, "model_dump") else dict(model)


def clean(value: Any) -> str:
    return str(value or "").strip()


def new_node_id() -> str:
    return f"cat-node-{uuid.uuid4().hex}"


def point_capable(node: dict[str, Any]) -> bool:
    return str(node.get("node_kind") or "") in POINT_KINDS


def actions_for_kind(kind: str) -> list[str]:
    if kind == "directory":
        return ["open_directory"]
    if kind == "point":
        return ["open_point"]
    return []


def node_select(where_clause: str) -> str:
    return f"""
        SELECT
          n.id AS node_id,
          n.chapter_id,
          c.chapter_title,
          n.parent_id,
          n.node_kind,
          n.title,
          n.summary,
          n.teacher_note,
          n.student_description,
          n.card_image_asset_id,
          n.card_icon_key,
          n.card_accent,
          n.card_layout,
          n.card_presentation,
          n.point_card_presentation,
          n.status,
          n.display_order,
          n.metadata,
          n.published_at,
          n.created_at,
          n.updated_at,
          EXISTS (
            SELECT 1 FROM experiment_catalog_nodes child
            WHERE child.parent_id = n.id AND child.status <> 'archived'
          ) AS has_children,
          CASE
            WHEN n.node_kind = 'directory' THEN (
              WITH RECURSIVE descendant_tree AS (
                SELECT child.id, child.parent_id, child.node_kind
                FROM experiment_catalog_nodes child
                WHERE child.parent_id = n.id
                  AND child.status <> 'archived'
                UNION ALL
                SELECT child.id, child.parent_id, child.node_kind
                FROM experiment_catalog_nodes child
                JOIN descendant_tree parent ON child.parent_id = parent.id
                WHERE child.status <> 'archived'
              )
              SELECT COUNT(*)
              FROM descendant_tree
              WHERE node_kind = 'point'
            )
            ELSE 0
          END AS descendant_point_count,
          EXISTS (
            SELECT 1 FROM experiment_catalog_point_content pc
            WHERE pc.node_id = n.id
          ) AS has_point_content,
          (
            SELECT COUNT(*)
            FROM experiment_catalog_point_media_bindings mb
            WHERE mb.node_id = n.id AND mb.binding_status <> 'archived'
          ) AS media_count,
          (
            SELECT COUNT(*)
            FROM experiment_catalog_point_media_bindings mb
            JOIN media_assets ma ON ma.id = mb.media_asset_id
            WHERE mb.node_id = n.id
              AND mb.binding_status = 'published'
              AND ma.upload_status = 'ready'
          ) AS published_media_count,
          (
            SELECT to_jsonb(s)
            FROM experiment_catalog_point_search_index_state s
            WHERE s.node_id = n.id
          ) AS index_state
        FROM experiment_catalog_nodes n
        JOIN chapters c ON c.id = n.chapter_id
        {where_clause}
    """


def row_dict(row: Any) -> dict[str, Any]:
    item = dict(row)
    item["node_id"] = str(item.get("node_id") or item.get("id") or "")
    item["descendant_point_count"] = int(item.get("descendant_point_count") or 0)
    item["media_count"] = int(item.get("media_count") or 0)
    item["published_media_count"] = int(item.get("published_media_count") or 0)
    if item.get("card_image_asset_id") is not None:
        item["card_image_asset_id"] = str(item["card_image_asset_id"])
    for key in ("metadata", "card_presentation", "point_card_presentation"):
        if not isinstance(item.get(key), dict):
            item[key] = {}
    if item.get("index_state") is not None and not isinstance(item.get("index_state"), dict):
        item["index_state"] = dict(item["index_state"])
    return item


def node_card(
    node: dict[str, Any],
    *,
    validation: dict[str, Any] | None = None,
    include_teacher_note: bool = False,
) -> dict[str, Any]:
    kind = str(node.get("node_kind") or "directory")
    card = {
        "node_id": node["node_id"],
        "chapter_id": node["chapter_id"],
        "parent_id": node.get("parent_id"),
        "node_kind": kind,
        "title": node.get("title") or "",
        "summary": node.get("summary") or "",
        "student_description": node.get("student_description") or "",
        "card_image_asset_id": node.get("card_image_asset_id"),
        "card_icon_key": node.get("card_icon_key"),
        "card_accent": node.get("card_accent"),
        "card_layout": node.get("card_layout") or "default",
        "card_presentation": node.get("card_presentation") if isinstance(node.get("card_presentation"), dict) else {},
        "point_card_presentation": node.get("point_card_presentation") if isinstance(node.get("point_card_presentation"), dict) else {},
        "status": node.get("status") or "draft",
        "display_order": int(node.get("display_order") or 0),
        "actions": actions_for_kind(kind),
        "has_children": bool(node.get("has_children")),
        "descendant_point_count": int(node.get("descendant_point_count") or 0) if kind == "directory" else 0,
        "has_point_content": bool(node.get("has_point_content")),
        "media_count": int(node.get("media_count") or 0),
        "published_media_count": int(node.get("published_media_count") or 0),
        "validation": validation if validation is not None else validate_node_payload(node),
        "index_state": node.get("index_state"),
    }
    if include_teacher_note:
        card["teacher_note"] = node.get("teacher_note") or ""
    return card


def get_node(session: Any, node_id: str, *, include_archived: bool = True) -> dict[str, Any]:
    status_filter = "" if include_archived else " AND n.status <> 'archived'"
    row = (
        session.execute(
            text(node_select(f"WHERE n.id = :node_id{status_filter}")),
            {"node_id": node_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog node not found")
    return row_dict(row)


def get_content(session: Any, node_id: str) -> dict[str, Any] | None:
    row = (
        session.execute(
            text(
                """
                SELECT node_id, point_title, teacher_note, principle_mode, principle_equation,
                       principle_text, phenomenon_explanation, safety_note, content_status,
                       published_at, published_by, created_by, updated_by, metadata,
                       created_at, updated_at
                FROM experiment_catalog_point_content
                WHERE node_id = :node_id
                """
            ),
            {"node_id": node_id},
        )
        .mappings()
        .first()
    )
    if not row:
        return None
    item = dict(row)
    if not isinstance(item.get("metadata"), dict):
        item["metadata"] = {}
    item["reaction_equations"] = list_reaction_equations(session, node_id) if item.get("principle_mode") == "equation" else []
    return item


def content_publication_errors(node: dict[str, Any], content: dict[str, Any] | None) -> list[str]:
    errors: list[str] = []
    if not clean(node.get("title")):
        errors.append("Node title is required")
    if not point_capable(node):
        return errors
    if node.get("has_children"):
        errors.append("Point nodes cannot have children")
    if not content:
        errors.append("Point content must be saved before publishing")
        return errors
    mode = clean(content.get("principle_mode") or "text")
    equation = clean(content.get("principle_equation"))
    principle_text = clean(content.get("principle_text"))
    if mode == "equation":
        if not reaction_principle_text(content):
            errors.append("Equation-mode principle requires at least one valid reaction equation")
    elif mode == "text":
        if not principle_text:
            errors.append("Text-mode principle requires a principle description")
    else:
        errors.append("Principle mode must be equation or text")
    if not clean(content.get("phenomenon_explanation")):
        errors.append("Phenomenon explanation is required")
    if not clean(content.get("safety_note")):
        errors.append("Safety note is required")
    return errors


def validate_node_payload(node: dict[str, Any], content: dict[str, Any] | None = None) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    kind = clean(node.get("node_kind"))
    if kind not in NODE_KINDS:
        errors.append("Node kind must be directory or point")
    if not clean(node.get("title")):
        errors.append("Title is required")
    if kind == "directory":
        if node.get("has_point_content") or int(node.get("media_count") or 0) > 0:
            errors.append("Directory nodes cannot own point content or videos")
        if not node.get("has_children"):
            warnings.append("Directory has no children")
    if kind == "point":
        if node.get("has_children"):
            errors.append("Point nodes cannot have children")
        if content and content.get("content_status") in {"draft", "archived"}:
            warnings.append("Point content is not published")
        elif not content:
            warnings.append("Point content has not been saved")
    return {"ok": not errors, "errors": errors, "warnings": warnings}


def breadcrumbs(session: Any, node_id: str) -> list[dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                WITH RECURSIVE path AS (
                  SELECT id, chapter_id, parent_id, node_kind, title, 0 AS depth
                  FROM experiment_catalog_nodes
                  WHERE id = :node_id
                  UNION ALL
                  SELECT parent.id, parent.chapter_id, parent.parent_id, parent.node_kind, parent.title, path.depth + 1
                  FROM experiment_catalog_nodes parent
                  JOIN path ON path.parent_id = parent.id
                )
                SELECT id AS node_id, title, node_kind, chapter_id
                FROM path
                ORDER BY depth DESC
                """
            ),
            {"node_id": node_id},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def catalog_path_text(session: Any, node_id: str) -> str:
    return " / ".join(item["title"] for item in breadcrumbs(session, node_id) if item.get("title"))


def published_path_available(session: Any, node_id: str) -> bool:
    return bool(
        session.execute(
            text(
                """
                WITH RECURSIVE path AS (
                  SELECT id, parent_id, status
                  FROM experiment_catalog_nodes
                  WHERE id = :node_id
                  UNION ALL
                  SELECT parent.id, parent.parent_id, parent.status
                  FROM experiment_catalog_nodes parent
                  JOIN path ON path.parent_id = parent.id
                )
                SELECT COALESCE(bool_and(status = 'published'), false)
                FROM path
                """
            ),
            {"node_id": node_id},
        ).scalar_one()
    )


def assert_no_parent_cycle(session: Any, *, node_id: str, new_parent_id: str | None) -> None:
    if not new_parent_id:
        return
    if node_id == new_parent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Node cannot be moved under itself")
    rows = (
        session.execute(
            text(
                """
                WITH RECURSIVE ancestors AS (
                  SELECT id, parent_id
                  FROM experiment_catalog_nodes
                  WHERE id = :parent_id
                  UNION ALL
                  SELECT parent.id, parent.parent_id
                  FROM experiment_catalog_nodes parent
                  JOIN ancestors ON ancestors.parent_id = parent.id
                )
                SELECT id FROM ancestors
                """
            ),
            {"parent_id": new_parent_id},
        )
        .scalars()
        .all()
    )
    if node_id in {str(row) for row in rows}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Move would create a catalog cycle")


def assert_parent_valid(session: Any, *, chapter_id: str, parent_id: str | None, node_id: str | None = None) -> None:
    if not parent_id:
        return
    parent = get_node(session, parent_id)
    if parent["chapter_id"] != chapter_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent must belong to the same chapter")
    if parent["node_kind"] != "directory":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Point nodes cannot have children")
    if node_id:
        assert_no_parent_cycle(session, node_id=node_id, new_parent_id=parent_id)


def max_child_order(session: Any, *, chapter_id: str, parent_id: str | None) -> int:
    if parent_id:
        value = session.execute(
            text("SELECT COALESCE(MAX(display_order), 0) FROM experiment_catalog_nodes WHERE parent_id = :parent_id"),
            {"parent_id": parent_id},
        ).scalar_one()
    else:
        value = session.execute(
            text("SELECT COALESCE(MAX(display_order), 0) FROM experiment_catalog_nodes WHERE chapter_id = :chapter_id AND parent_id IS NULL"),
            {"chapter_id": chapter_id},
        ).scalar_one()
    return int(value or 0)


def has_point_resources(session: Any, node_id: str) -> bool:
    return bool(
        session.execute(
            text(
                """
                SELECT EXISTS (
                  SELECT 1 FROM experiment_catalog_point_content WHERE node_id = :node_id
                  UNION ALL
                  SELECT 1 FROM experiment_catalog_point_media_bindings WHERE node_id = :node_id AND binding_status <> 'archived'
                  UNION ALL
                  SELECT 1 FROM experiment_catalog_point_related_links WHERE source_node_id = :node_id
                )
                """
            ),
            {"node_id": node_id},
        ).scalar_one()
    )


def assert_kind_transition(session: Any, *, node: dict[str, Any], new_kind: str) -> None:
    if new_kind == "point" and node.get("has_children"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Point nodes cannot have children")
    if new_kind == "directory" and node["node_kind"] == "point" and has_point_resources(session, node["node_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Point nodes with content or videos cannot be converted to directories")
