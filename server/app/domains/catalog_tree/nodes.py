from __future__ import annotations

from typing import Any

from sqlalchemy import text

from server.app.catalog_tree_schemas import (
    CatalogNodeCreateRequest,
    CatalogNodeMoveRequest,
    CatalogNodeReorderRequest,
    CatalogNodeStatusRequest,
    CatalogNodeUpdateRequest,
)
from server.app.domains.catalog_tree.common import (
    NODE_KINDS,
    assert_kind_transition,
    assert_parent_valid,
    breadcrumbs,
    clean,
    content_publication_errors,
    dump_model,
    get_content,
    get_node,
    json_dump,
    max_child_order,
    new_node_id,
    node_card,
    node_select,
    point_capable,
    row_dict,
    validate_node_payload,
)
from server.app.domains.catalog_tree.directories import create_node_params, update_node_params
from server.app.domains.catalog_tree.search_documents import queue_index_state, queue_subtree_point_indexes, search_preview_for_node
from server.app.domains.errors import DomainHTTPException as HTTPException, domain_status as status
from server.app.infrastructure.database import db_session


def _payload_data(payload: Any, *, exclude_unset: bool = False) -> dict[str, Any]:
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=exclude_unset)
    return dict(payload)


def _child_cards(session: Any, *, node_id: str, include_archived: bool, include_teacher_note: bool) -> list[dict[str, Any]]:
    status_clause = "" if include_archived else "AND n.status <> 'archived'"
    rows = (
        session.execute(
            text(
                node_select(
                    f"""
                    WHERE n.parent_id = :node_id
                      {status_clause}
                    ORDER BY n.display_order, n.id
                    """
                )
            ),
            {"node_id": node_id},
        )
        .mappings()
        .all()
    )
    return [node_card(row_dict(row), include_teacher_note=include_teacher_note) for row in rows]


def _normalize_sibling_orders(session: Any, *, chapter_id: str, parent_id: str | None) -> None:
    if parent_id:
        rows = session.execute(
            text("SELECT id FROM experiment_catalog_nodes WHERE parent_id = :parent_id ORDER BY display_order, updated_at DESC, id"),
            {"parent_id": parent_id},
        ).scalars().all()
    else:
        rows = session.execute(
            text(
                """
                SELECT id
                FROM experiment_catalog_nodes
                WHERE chapter_id = :chapter_id AND parent_id IS NULL
                ORDER BY display_order, updated_at DESC, id
                """
            ),
            {"chapter_id": chapter_id},
        ).scalars().all()
    for index, sibling_id in enumerate(rows, start=1):
        session.execute(
            text("UPDATE experiment_catalog_nodes SET display_order = :display_order WHERE id = :node_id"),
            {"node_id": str(sibling_id), "display_order": index},
        )


def list_chapter_roots(*, chapter_id: str, include_archived: bool = False) -> dict[str, Any]:
    status_clause = "" if include_archived else "AND n.status <> 'archived'"
    with db_session() as session:
        chapter = session.execute(
            text("SELECT id AS chapter_id, chapter_title FROM chapters WHERE id = :chapter_id"),
            {"chapter_id": chapter_id},
        ).mappings().first()
        if not chapter:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
        rows = (
            session.execute(
                text(
                    node_select(
                        f"""
                        WHERE n.chapter_id = :chapter_id
                          AND n.parent_id IS NULL
                          {status_clause}
                        ORDER BY n.display_order, n.id
                        """
                    )
                ),
                {"chapter_id": chapter_id},
            )
            .mappings()
            .all()
        )
        nodes = [node_card(row_dict(row), include_teacher_note=True) for row in rows]
    return {"chapter": dict(chapter), "nodes": nodes}


def list_node_children(*, node_id: str, include_archived: bool = False) -> dict[str, Any]:
    with db_session() as session:
        parent = get_node(session, node_id)
        children = _child_cards(session, node_id=node_id, include_archived=include_archived, include_teacher_note=True)
    return {"parent": node_card(parent, include_teacher_note=True), "children": children}


def get_node_detail(*, node_id: str) -> dict[str, Any]:
    from server.app.domains.catalog_tree.media_bindings import media_bindings
    from server.app.domains.catalog_tree.related_links import related_links

    with db_session() as session:
        node = get_node(session, node_id)
        content = get_content(session, node_id) if point_capable(node) else None
        children = _child_cards(session, node_id=node_id, include_archived=False, include_teacher_note=True)
        media = media_bindings(session, node_id) if point_capable(node) else []
        related = related_links(session, node_id, include_hidden=True, include_defaults=True) if point_capable(node) else []
        validation = validate_selected_node(session, node_id=node_id)
        return {
            "node": node_card(node, validation=validation, include_teacher_note=True),
            "breadcrumbs": breadcrumbs(session, node_id),
            "children": children,
            "point_content": content,
            "media_bindings": media,
            "related_links": related,
            "validation": validation,
            "search_preview": search_preview_for_node(session, node_id=node_id),
            "index_state": node.get("index_state"),
        }


def create_node(*, payload: CatalogNodeCreateRequest, user: Any) -> dict[str, Any]:
    data = dump_model(payload)
    kind = clean(data.get("node_kind") or "directory")
    if kind not in NODE_KINDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid node kind")
    node_id = new_node_id()
    title = clean(data.get("title"))
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")
    with db_session() as session:
        chapter_id = clean(data.get("chapter_id"))
        if not session.execute(text("SELECT 1 FROM chapters WHERE id = :chapter_id"), {"chapter_id": chapter_id}).first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
        parent_id = clean(data.get("parent_id")) or None
        assert_parent_valid(session, chapter_id=chapter_id, parent_id=parent_id)
        display_order = max_child_order(session, chapter_id=chapter_id, parent_id=parent_id) + 1
        card = create_node_params(data, kind=kind)
        session.execute(
            text(
                """
                INSERT INTO experiment_catalog_nodes (
                  id, chapter_id, parent_id, node_kind, title, summary, teacher_note,
                  student_description, card_image_asset_id, card_icon_key, card_accent,
                  card_layout, card_presentation, point_card_presentation, status,
                  display_order, metadata, created_by, updated_by, updated_at
                )
                VALUES (
                  :id, :chapter_id, :parent_id, :node_kind, :title, :summary, :teacher_note,
                  :student_description, CAST(:card_image_asset_id AS uuid), :card_icon_key, :card_accent,
                  :card_layout, CAST(:card_presentation AS jsonb), CAST(:point_card_presentation AS jsonb), 'draft',
                  :display_order, CAST(:metadata AS jsonb), CAST(:user_id AS uuid), CAST(:user_id AS uuid), now()
                )
                """
            ),
            {
                "id": node_id,
                "chapter_id": chapter_id,
                "parent_id": parent_id,
                "node_kind": kind,
                "title": title,
                "display_order": display_order,
                "metadata": json_dump(data.get("metadata") if isinstance(data.get("metadata"), dict) else {}),
                "user_id": user.id,
                **card,
            },
        )
    return get_node_detail(node_id=node_id)


def update_node(*, node_id: str, payload: CatalogNodeUpdateRequest, user: Any) -> dict[str, Any]:
    data = _payload_data(payload, exclude_unset=True)
    with db_session() as session:
        node = get_node(session, node_id)
        new_kind = clean(data.get("node_kind")) or node["node_kind"]
        if new_kind not in NODE_KINDS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid node kind")
        assert_kind_transition(session, node=node, new_kind=new_kind)
        title = clean(data.get("title")) if data.get("title") is not None else node["title"]
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title is required")
        metadata = node["metadata"]
        if isinstance(data.get("metadata"), dict):
            metadata = {**metadata, **data["metadata"]}
        card = update_node_params(data, node, kind=new_kind)
        session.execute(
            text(
                """
                UPDATE experiment_catalog_nodes
                SET title = :title,
                    summary = :summary,
                    teacher_note = :teacher_note,
                    student_description = :student_description,
                    card_image_asset_id = CAST(:card_image_asset_id AS uuid),
                    card_icon_key = :card_icon_key,
                    card_accent = :card_accent,
                    card_layout = :card_layout,
                    card_presentation = CAST(:card_presentation AS jsonb),
                    point_card_presentation = CAST(:point_card_presentation AS jsonb),
                    node_kind = :node_kind,
                    metadata = CAST(:metadata AS jsonb),
                    updated_by = CAST(:user_id AS uuid),
                    updated_at = now()
                WHERE id = :node_id
                """
            ),
            {
                "node_id": node_id,
                "title": title,
                "node_kind": new_kind,
                "metadata": json_dump(metadata),
                "user_id": user.id,
                **card,
            },
        )
        if new_kind == "point" or node["node_kind"] == "point":
            queue_index_state(session, node_id=node_id, action="upsert" if node["status"] == "published" else "delete")
        else:
            queue_subtree_point_indexes(session, node_id=node_id)
    return get_node_detail(node_id=node_id)


def move_node(*, node_id: str, payload: CatalogNodeMoveRequest, user: Any) -> dict[str, Any]:
    data = dump_model(payload)
    with db_session() as session:
        node = get_node(session, node_id)
        parent_id = clean(data.get("parent_id")) or None
        assert_parent_valid(session, chapter_id=node["chapter_id"], parent_id=parent_id, node_id=node_id)
        display_order = int(data["display_order"]) if data.get("display_order") is not None else max_child_order(
            session, chapter_id=node["chapter_id"], parent_id=parent_id
        ) + 1
        session.execute(
            text(
                """
                UPDATE experiment_catalog_nodes
                SET parent_id = :parent_id,
                    display_order = :display_order,
                    updated_by = CAST(:user_id AS uuid),
                    updated_at = now()
                WHERE id = :node_id
                """
            ),
            {"node_id": node_id, "parent_id": parent_id, "display_order": display_order, "user_id": user.id},
        )
        _normalize_sibling_orders(session, chapter_id=node["chapter_id"], parent_id=parent_id)
        queue_subtree_point_indexes(session, node_id=node_id)
    return get_node_detail(node_id=node_id)


def reorder_siblings(*, payload: CatalogNodeReorderRequest, user: Any) -> dict[str, Any]:
    data = dump_model(payload)
    items = data.get("items") or []
    if not items:
        return {"updated": 0}
    with db_session() as session:
        node_ids = [clean(item.get("node_id")) for item in items]
        rows = session.execute(
            text("SELECT id, parent_id, chapter_id FROM experiment_catalog_nodes WHERE id = ANY(:node_ids)"),
            {"node_ids": node_ids},
        ).mappings().all()
        if len(rows) != len(node_ids):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more nodes were not found")
        parents = {(row["chapter_id"], row["parent_id"]) for row in rows}
        if len(parents) != 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reorder only supports siblings")
        for item in items:
            session.execute(
                text(
                    """
                    UPDATE experiment_catalog_nodes
                    SET display_order = :display_order,
                        updated_by = CAST(:user_id AS uuid),
                        updated_at = now()
                    WHERE id = :node_id
                    """
                ),
                {"node_id": clean(item.get("node_id")), "display_order": int(item.get("display_order") or 0), "user_id": user.id},
            )
        chapter_id, parent_id = next(iter(parents))
        _normalize_sibling_orders(session, chapter_id=str(chapter_id), parent_id=str(parent_id) if parent_id else None)
        for changed_node_id in node_ids:
            queue_subtree_point_indexes(session, node_id=changed_node_id)
    return {"updated": len(items)}


def set_node_status(*, node_id: str, payload: CatalogNodeStatusRequest, user: Any) -> dict[str, Any]:
    action = payload.action
    include_subtree = payload.include_subtree
    with db_session() as session:
        get_node(session, node_id)
        node_ids = [node_id]
        if include_subtree:
            node_ids = [
                str(row)
                for row in session.execute(
                    text(
                        """
                        WITH RECURSIVE subtree AS (
                          SELECT id FROM experiment_catalog_nodes WHERE id = :node_id
                          UNION ALL
                          SELECT child.id FROM experiment_catalog_nodes child JOIN subtree ON child.parent_id = subtree.id
                        )
                        SELECT id FROM subtree
                        """
                    ),
                    {"node_id": node_id},
                ).scalars().all()
            ]
        if action == "publish":
            validation = validate_selected_node(session, node_id=node_id, include_subtree=include_subtree)
            if validation["errors"]:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=validation["errors"])
            new_status = "published"
            published_at_sql = "published_at = COALESCE(published_at, now()),"
        elif action == "unpublish":
            new_status = "draft"
            published_at_sql = "published_at = NULL,"
        elif action == "archive":
            new_status = "archived"
            published_at_sql = "published_at = NULL,"
        elif action == "restore":
            new_status = "draft"
            published_at_sql = "published_at = NULL,"
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported status action")
        session.execute(
            text(
                f"""
                UPDATE experiment_catalog_nodes
                SET status = :status,
                    {published_at_sql}
                    updated_by = CAST(:user_id AS uuid),
                    updated_at = now()
                WHERE id = ANY(:node_ids)
                """
            ),
            {"status": new_status, "node_ids": node_ids, "user_id": user.id},
        )
        for changed_node_id in node_ids:
            queue_subtree_point_indexes(
                session,
                node_id=changed_node_id,
                action="delete" if action in {"unpublish", "archive"} else "upsert",
            )
    return get_node_detail(node_id=node_id)


def validate_selected_node(session: Any, *, node_id: str, include_subtree: bool = False) -> dict[str, Any]:
    node_ids = [node_id]
    if include_subtree:
        node_ids = [
            str(row)
            for row in session.execute(
                text(
                    """
                    WITH RECURSIVE subtree AS (
                      SELECT id FROM experiment_catalog_nodes WHERE id = :node_id
                      UNION ALL
                      SELECT child.id FROM experiment_catalog_nodes child JOIN subtree ON child.parent_id = subtree.id
                    )
                    SELECT id FROM subtree
                    """
                ),
                {"node_id": node_id},
            ).scalars().all()
        ]
    errors: list[str] = []
    warnings: list[str] = []
    nodes: list[dict[str, Any]] = []
    for current_id in node_ids:
        node = get_node(session, current_id)
        content = get_content(session, current_id) if point_capable(node) else None
        node_validation = validate_node_payload(node, content)
        publish_errors = content_publication_errors(node, content)
        current_errors = [*node_validation["errors"], *publish_errors]
        current_warnings = node_validation["warnings"]
        errors.extend(f"{node['title']}: {error}" for error in current_errors)
        warnings.extend(f"{node['title']}: {warning}" for warning in current_warnings)
        nodes.append({"node_id": node["node_id"], "title": node["title"], "errors": current_errors, "warnings": current_warnings})
    return {"ok": not errors, "errors": errors, "warnings": warnings, "nodes": nodes}


def search_catalog_nodes(*, query: str, chapter_id: str | None = None, limit: int = 80) -> dict[str, Any]:
    term = f"%{clean(query)}%"
    filters = ["n.status <> 'archived'"]
    params: dict[str, Any] = {"term": term, "limit": limit}
    if chapter_id:
        filters.append("n.chapter_id = :chapter_id")
        params["chapter_id"] = chapter_id
    where = " AND ".join(filters)
    with db_session() as session:
        rows = (
            session.execute(
                text(
                    node_select(
                        f"""
                        LEFT JOIN experiment_catalog_point_content pc ON pc.node_id = n.id
                        LEFT JOIN experiment_catalog_legacy_identity_map legacy ON legacy.catalog_node_id = n.id
                        WHERE {where}
                          AND (
                            n.title ILIKE :term
                            OR n.summary ILIKE :term
                            OR n.student_description ILIKE :term
                            OR n.teacher_note ILIKE :term
                            OR pc.point_title ILIKE :term
                            OR pc.principle_equation ILIKE :term
                            OR pc.principle_text ILIKE :term
                            OR pc.phenomenon_explanation ILIKE :term
                            OR pc.safety_note ILIKE :term
                            OR pc.teacher_note ILIKE :term
                            OR legacy.legacy_experiment_id ILIKE :term
                            OR legacy.legacy_point_key ILIKE :term
                          )
                        ORDER BY n.updated_at DESC
                        LIMIT :limit
                        """
                    )
                ),
                params,
            )
            .mappings()
            .all()
        )
    return {"query": query, "items": [node_card(row_dict(row), include_teacher_note=True) for row in rows]}
