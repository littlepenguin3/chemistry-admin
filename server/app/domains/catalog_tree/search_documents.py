from __future__ import annotations

from typing import Any

from sqlalchemy import text

from server.app.chemistry_search import chemistry_terms_for_document
from server.app.domains.catalog_tree.common import (
    breadcrumbs,
    clean,
    get_content,
    get_node,
    point_capable,
    published_path_available,
)


def queue_index_state(session: Any, *, node_id: str, action: str = "upsert", last_error: str | None = None) -> None:
    session.execute(
        text(
            """
            INSERT INTO experiment_catalog_point_search_index_state (
              node_id, document_id, desired_action, sync_status, attempts, last_error, updated_at
            )
            VALUES (
              :node_id, :node_id, :desired_action, 'pending', 0, :last_error, now()
            )
            ON CONFLICT (node_id) DO UPDATE SET
              document_id = EXCLUDED.document_id,
              desired_action = EXCLUDED.desired_action,
              sync_status = 'pending',
              last_error = EXCLUDED.last_error,
              updated_at = now()
            """
        ),
        {"node_id": node_id, "desired_action": action, "last_error": last_error},
    )


def queue_subtree_point_indexes(session: Any, *, node_id: str, action: str = "upsert") -> None:
    rows = (
        session.execute(
            text(
                """
                WITH RECURSIVE subtree AS (
                  SELECT id, node_kind
                  FROM experiment_catalog_nodes
                  WHERE id = :node_id
                  UNION ALL
                  SELECT child.id, child.node_kind
                  FROM experiment_catalog_nodes child
                  JOIN subtree ON child.parent_id = subtree.id
                )
                SELECT id FROM subtree WHERE node_kind = 'point'
                """
            ),
            {"node_id": node_id},
        )
        .scalars()
        .all()
    )
    for point_node_id in rows:
        queue_index_state(session, node_id=str(point_node_id), action=action)


def _ancestor_directory_context(session: Any, node_id: str) -> list[dict[str, Any]]:
    rows = (
        session.execute(
            text(
                """
                WITH RECURSIVE path AS (
                  SELECT id, parent_id, node_kind, title, student_description, card_icon_key, card_accent, 0 AS depth
                  FROM experiment_catalog_nodes
                  WHERE id = :node_id
                  UNION ALL
                  SELECT parent.id, parent.parent_id, parent.node_kind, parent.title,
                         parent.student_description, parent.card_icon_key, parent.card_accent, path.depth + 1
                  FROM experiment_catalog_nodes parent
                  JOIN path ON path.parent_id = parent.id
                )
                SELECT title, student_description, card_icon_key, card_accent
                FROM path
                WHERE node_kind = 'directory'
                ORDER BY depth DESC
                """
            ),
            {"node_id": node_id},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def search_preview_for_node(session: Any, *, node_id: str) -> dict[str, Any] | None:
    node = get_node(session, node_id)
    if not point_capable(node):
        return None
    return student_search_document_for_node(session, node_id=node["node_id"], require_published=False)


def student_search_document_for_node(session: Any, *, node_id: str, require_published: bool = True) -> dict[str, Any] | None:
    node = get_node(session, node_id, include_archived=not require_published)
    if not point_capable(node):
        return None
    content = get_content(session, node["node_id"])
    if require_published:
        if node["status"] != "published" or not content or content.get("content_status") != "published":
            return None
        if not published_path_available(session, node["node_id"]):
            return None
    if not content:
        return None

    from server.app.domains.catalog_tree.media_bindings import student_videos
    from server.app.domains.catalog_tree.related_links import related_links

    path = breadcrumbs(session, node["node_id"])
    path_text = " / ".join(item["title"] for item in path)
    directory_context = _ancestor_directory_context(session, node["node_id"])
    category_text = " ".join(
        clean(value)
        for directory in directory_context
        for value in (
            directory.get("title"),
            directory.get("student_description"),
            directory.get("card_icon_key"),
            directory.get("card_accent"),
        )
        if clean(value)
    )
    related = related_links(session, node["node_id"], include_hidden=False, include_defaults=True)
    videos = student_videos(session, node["node_id"])
    principle = (
        clean(content.get("principle_equation"))
        if content.get("principle_mode") == "equation"
        else clean(content.get("principle_text"))
    )
    phenomenon = clean(content.get("phenomenon_explanation"))
    safety = clean(content.get("safety_note"))
    chemistry = chemistry_terms_for_document(content.get("point_title"), principle, phenomenon, safety)
    search_text = " ".join(
        item
        for item in [
            path_text,
            category_text,
            clean(content.get("point_title")),
            principle,
            phenomenon,
            safety,
            " ".join(clean(link.get("target_title")) for link in related),
            " ".join(clean(video.get("title")) for video in videos),
            " ".join(chemistry["formulae"]),
            " ".join(chemistry["aliases"]),
            " ".join(chemistry["reaction_features"]),
        ]
        if item
    )
    return {
        "id": node["node_id"],
        "result_type": "video_point",
        "node_id": node["node_id"],
        "chapter_id": node["chapter_id"],
        "chapter_path": [path[0]["title"]] if path else [],
        "catalog_path": [item["title"] for item in path],
        "category_text": category_text,
        "title": clean(content.get("point_title")) or node["title"],
        "subtitle": path_text,
        "snippet": phenomenon or principle,
        "search_text": search_text,
        "principle": principle,
        "phenomenon_explanation": phenomenon,
        "safety_note": safety,
        "formulae": chemistry["formulae"],
        "aliases": chemistry["aliases"],
        "reaction_features": chemistry["reaction_features"],
        "related_text": [clean(link.get("target_title")) for link in related if clean(link.get("target_title"))],
        "has_video": bool(videos),
        "video_count": len(videos),
        "videos": [{"media_id": video["media_id"], "title": video["title"]} for video in videos],
        "target": {
            "kind": "point_detail",
            "route": f"/point/{node['node_id']}",
            "node_id": node["node_id"],
            "chapter_id": node["chapter_id"],
            "context_title": clean(content.get("point_title")) or node["title"],
            "context_summary": phenomenon or principle,
        },
        "updated_at": content.get("updated_at") or node.get("updated_at"),
    }
