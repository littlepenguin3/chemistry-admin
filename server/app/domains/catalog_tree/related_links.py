from __future__ import annotations

from typing import Any

from sqlalchemy import text

from server.app.catalog_tree_schemas import CatalogPointRelatedLinksRequest
from server.app.domains.catalog_tree.common import clean, dump_model, get_node, json_dump, point_capable
from server.app.domains.catalog_tree.search_documents import queue_index_state
from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from server.app.infrastructure.database import db_session


def related_links(session: Any, node_id: str, *, include_hidden: bool, include_defaults: bool) -> list[dict[str, Any]]:
    hidden_clause = "" if include_hidden else "AND l.hidden = false"
    rows = (
        session.execute(
            text(
                f"""
                SELECT l.id, l.source_node_id, l.target_node_id, l.relation_type, l.hidden,
                       l.sort_order, l.label, l.metadata, target.title AS target_title,
                       target.status AS target_status, target.node_kind AS target_kind
                FROM experiment_catalog_point_related_links l
                JOIN experiment_catalog_nodes target ON target.id = l.target_node_id
                WHERE l.source_node_id = :node_id
                  {hidden_clause}
                ORDER BY l.sort_order, l.created_at
                """
            ),
            {"node_id": node_id},
        )
        .mappings()
        .all()
    )
    result = [
        {
            "id": str(row["id"]),
            "source_node_id": row["source_node_id"],
            "target_node_id": row["target_node_id"],
            "target_title": row["label"] or row["target_title"],
            "relation_type": row["relation_type"],
            "hidden": bool(row["hidden"]),
            "sort_order": int(row["sort_order"] or 0),
            "label": row["label"],
            "source": "manual",
            "metadata": row["metadata"] if isinstance(row["metadata"], dict) else {},
        }
        for row in rows
        if row["target_kind"] == "point" and (include_hidden or (not row["hidden"] and row["target_status"] == "published"))
    ]
    if not include_defaults:
        return result
    existing_targets = {item["target_node_id"] for item in result}
    node = get_node(session, node_id)
    default_rows = (
        session.execute(
            text(
                """
                SELECT sibling.id AS target_node_id, sibling.title AS target_title, sibling.display_order
                FROM experiment_catalog_nodes sibling
                WHERE sibling.parent_id IS NOT DISTINCT FROM :parent_id
                  AND sibling.id <> :node_id
                  AND sibling.node_kind = 'point'
                  AND sibling.status = 'published'
                ORDER BY ABS(sibling.display_order - :display_order), sibling.display_order
                LIMIT 6
                """
            ),
            {"node_id": node_id, "parent_id": node.get("parent_id"), "display_order": int(node.get("display_order") or 0)},
        )
        .mappings()
        .all()
    )
    for index, row in enumerate(default_rows, start=len(result) + 1):
        if row["target_node_id"] in existing_targets:
            continue
        result.append(
            {
                "id": None,
                "source_node_id": node_id,
                "target_node_id": row["target_node_id"],
                "target_title": row["target_title"],
                "relation_type": "generated_default",
                "hidden": False,
                "sort_order": index,
                "label": None,
                "source": "generated_default",
                "metadata": {"generated_from": "same_parent_neighborhood"},
            }
        )
    return result


def replace_related_links(*, node_id: str, payload: CatalogPointRelatedLinksRequest, user: Any) -> dict[str, Any]:
    data = dump_model(payload)
    links = data.get("links") or []
    with db_session() as session:
        source = get_node(session, node_id)
        if not point_capable(source):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Directory nodes cannot own related point links")
        for link in links:
            target = get_node(session, clean(link.get("target_node_id")), include_archived=False)
            if not point_capable(target):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Related link target must be a point")
            if target["node_id"] == node_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Related link cannot target itself")
        session.execute(
            text("DELETE FROM experiment_catalog_point_related_links WHERE source_node_id = :node_id"),
            {"node_id": node_id},
        )
        for index, link in enumerate(links):
            session.execute(
                text(
                    """
                    INSERT INTO experiment_catalog_point_related_links (
                      source_node_id, target_node_id, relation_type, hidden, sort_order, label,
                      metadata, created_by, updated_by, updated_at
                    )
                    VALUES (
                      :source_node_id, :target_node_id, :relation_type, :hidden, :sort_order, :label,
                      CAST(:metadata AS jsonb), CAST(:user_id AS uuid), CAST(:user_id AS uuid), now()
                    )
                    ON CONFLICT (source_node_id, target_node_id) DO UPDATE SET
                      relation_type = EXCLUDED.relation_type,
                      hidden = EXCLUDED.hidden,
                      sort_order = EXCLUDED.sort_order,
                      label = EXCLUDED.label,
                      metadata = EXCLUDED.metadata,
                      updated_by = EXCLUDED.updated_by,
                      updated_at = now()
                    """
                ),
                {
                    "source_node_id": node_id,
                    "target_node_id": clean(link.get("target_node_id")),
                    "relation_type": clean(link.get("relation_type") or "manual"),
                    "hidden": bool(link.get("hidden")),
                    "sort_order": int(link.get("sort_order") or index + 1),
                    "label": clean(link.get("label")) or None,
                    "metadata": json_dump(link.get("metadata") if isinstance(link.get("metadata"), dict) else {}),
                    "user_id": user.id,
                },
            )
        queue_index_state(session, node_id=node_id, action="upsert" if source["status"] == "published" else "delete")
    from server.app.domains.catalog_tree.nodes import get_node_detail

    return get_node_detail(node_id=node_id)
