from __future__ import annotations

import json
from pathlib import Path

from server.app.domains.catalog_tree.common import node_card, node_select, row_dict, validate_node_payload
from server.app.domains.catalog_tree.directories import create_node_params


SERVER_DIR = Path(__file__).resolve().parents[1]
CATALOG_DIR = SERVER_DIR / "app" / "domains" / "catalog_tree"


def test_directory_payload_keeps_only_lightweight_authoring_fields() -> None:
    params = create_node_params(
        {
            "summary": " Teacher summary ",
            "teacher_note": " private author note ",
        },
        kind="directory",
    )

    assert params == {"summary": "Teacher summary", "teacher_note": "private author note"}

    card = node_card(
        {
            "node_id": "cat-dir-1",
            "chapter_id": "CH1",
            "parent_id": None,
            "node_kind": "directory",
            "title": "Oxidation categories",
            "summary": "Teacher summary",
            "teacher_note": "private author note",
            "status": "published",
            "display_order": 1,
            "has_children": True,
            "has_point_content": False,
            "media_count": 0,
            "published_media_count": 0,
        },
        validation={"ok": True, "errors": [], "warnings": []},
        include_teacher_note=False,
    )

    assert card["actions"] == ["open_directory"]
    assert card["summary"] == "Teacher summary"
    assert card["descendant_point_count"] == 0
    assert "teacher_note" not in card
    assert "student_description" not in card
    assert "card_presentation" not in card


def test_directory_summary_is_the_only_student_card_summary_source() -> None:
    params = create_node_params(
        {
            "summary": "Teacher-only legacy summary",
            "teacher_note": "private author note",
        },
        kind="directory",
    )

    assert params["summary"] == "Teacher-only legacy summary"
    assert params["teacher_note"] == "private author note"

    card = node_card(
        {
            "node_id": "cat-dir-1",
            "chapter_id": "CH1",
            "parent_id": None,
            "node_kind": "directory",
            "title": "Oxidation categories",
            "summary": "Teacher-only legacy summary",
            "status": "published",
            "display_order": 1,
            "has_children": True,
            "has_point_content": False,
            "media_count": 0,
            "published_media_count": 0,
        }
    )

    assert card["summary"] == "Teacher-only legacy summary"
    assert "student_description" not in card


def test_catalog_node_card_exposes_recursive_point_count_contract() -> None:
    directory_row = row_dict(
        {
            "node_id": "cat-dir-1",
            "chapter_id": "CH1",
            "parent_id": None,
            "node_kind": "directory",
            "title": "Oxidation categories",
            "summary": "",
            "status": "published",
            "display_order": 1,
            "has_children": True,
            "descendant_point_count": "3",
            "has_point_content": False,
            "media_count": "0",
            "published_media_count": "0",
        }
    )
    point_row = row_dict(
        {
            "node_id": "cat-point-1",
            "chapter_id": "CH1",
            "parent_id": "cat-dir-1",
            "node_kind": "point",
            "title": "Chlorine water reaction",
            "summary": "",
            "status": "draft",
            "display_order": 1,
            "has_children": False,
            "descendant_point_count": "9",
            "has_point_content": True,
            "media_count": "1",
            "published_media_count": "1",
        }
    )

    assert directory_row["descendant_point_count"] == 3
    assert node_card(directory_row)["descendant_point_count"] == 3
    assert node_card(point_row)["descendant_point_count"] == 0


def test_catalog_node_select_counts_non_archived_descendant_points_recursively() -> None:
    query = node_select("WHERE n.id = :node_id")

    assert "AS descendant_point_count" in query
    assert "WITH RECURSIVE descendant_tree AS" in query
    assert "WHERE child.parent_id = n.id" in query
    assert "JOIN descendant_tree parent ON child.parent_id = parent.id" in query
    assert query.count("child.status <> 'archived'") >= 3
    assert "WHERE node_kind = 'point'" in query
    assert "ELSE 0" in query
    assert "AS point_content_status" in query
    assert "AS evidence_state" in query
    assert "AS descendant_status_counts" in query
    assert "SELECT pc.node_id AS content_id" in query
    assert "SELECT pc.id AS content_id" not in query
    assert "AND dt.canonical_point_id IS NULL" in query
    assert "dpc.content_id IS NULL" in query
    assert "AND (dt.status <> 'published' OR COALESCE(dpc.content_status, 'missing') <> 'published')" not in query
    assert "AND COALESCE(dpc.content_status, 'missing') = 'published'" not in query


def test_catalog_node_status_is_in_all_teacher_read_payload_contracts() -> None:
    nodes_source = (CATALOG_DIR / "nodes.py").read_text(encoding="utf-8")
    common_source = (CATALOG_DIR / "common.py").read_text(encoding="utf-8")

    assert '"node_status": catalog_node_status_summary' in common_source
    assert "nodes = [node_card(row_dict(row), include_teacher_note=True) for row in rows]" in nodes_source
    assert 'return {"parent": node_card(parent, include_teacher_note=True), "children": children}' in nodes_source
    assert '"node_status": node_status' in nodes_source
    assert '"items": [node_card(row_dict(row), include_teacher_note=True) for row in rows]' in nodes_source


def test_related_default_links_cast_nullable_canonical_point_parameter() -> None:
    related_source = (CATALOG_DIR / "related_links.py").read_text(encoding="utf-8")

    assert "CAST(:source_canonical_point_id AS text) IS NULL" in related_source
    assert "sibling.canonical_point_id IS DISTINCT FROM CAST(:source_canonical_point_id AS text)" in related_source


def _point_node(**overrides: object) -> dict[str, object]:
    return {
        "node_id": "cat-point-1",
        "chapter_id": "CH1",
        "parent_id": None,
        "node_kind": "point",
        "title": "Chlorine water point",
        "summary": "",
        "canonical_point_id": "cat-canon-1",
        "canonical_point_status": "published",
        "status": "published",
        "display_order": 1,
        "has_children": False,
        "has_point_content": True,
        "media_count": 1,
        "published_media_count": 1,
        "active_placement_count": 1,
        "index_state": None,
        "evidence_state": None,
        **overrides,
    }


def _complete_content(**overrides: object) -> dict[str, object]:
    return {
        "content_status": "published",
        "point_title": "Chlorine water point",
        "principle_mode": "text",
        "principle_text": "Chlorine water oxidizes bromide ions.",
        "phenomenon_explanation": "The organic layer turns orange.",
        "safety_note": "Use small amounts and ventilation.",
        **overrides,
    }


def test_node_status_prioritizes_missing_video_over_publication() -> None:
    card = node_card(
        _point_node(media_count=0, published_media_count=0),
        content=_complete_content(),
        validation={"ok": True, "errors": [], "warnings": []},
    )

    assert card["node_status"]["primary_state"] == "needs_video"
    assert card["node_status"]["primary_reason"] == "无视频"
    assert card["node_status"]["core_readiness"]["video"] == "absent"
    assert card["node_status"]["core_readiness"]["video_label"] == "无视频"
    assert card["node_status"]["visibility"]["student_available"] is True


def test_node_status_prioritizes_missing_content_before_missing_video() -> None:
    card = node_card(
        _point_node(has_point_content=False, media_count=0, published_media_count=0),
        validation={"ok": True, "errors": [], "warnings": []},
    )

    assert card["node_status"]["primary_state"] == "needs_content"
    assert card["node_status"]["primary_reason"] == "缺少原理、现象解释、安全提示"
    assert card["node_status"]["core_readiness"]["content_fields"] == "missing"
    assert card["node_status"]["core_readiness"]["video"] == "absent"
    assert card["node_status"]["visibility"]["student_available"] is True
    assert not any(condition["key"] == "experiment_video_missing" for condition in card["node_status"]["conditions"])


def test_node_status_prioritizes_missing_learning_fields_before_sync_state() -> None:
    card = node_card(
        _point_node(index_state={"sync_status": "failed", "last_error": "ES down"}),
        content=_complete_content(phenomenon_explanation="", safety_note=""),
        validation={"ok": True, "errors": [], "warnings": []},
    )

    assert card["node_status"]["primary_state"] == "needs_content"
    assert card["node_status"]["core_readiness"]["missing_fields"] == ["现象解释", "安全提示"]
    assert card["node_status"]["async_consumption"]["search_index"] == "failed"


def test_node_status_escalates_published_sync_failure_to_attention() -> None:
    card = node_card(
        _point_node(
            index_state={"sync_status": "failed", "last_error": "ES down"},
            evidence_state={"evidence_status": "succeeded"},
        ),
        content=_complete_content(),
        validation={"ok": True, "errors": [], "warnings": []},
    )

    assert card["node_status"]["primary_state"] == "sync_attention"
    assert card["node_status"]["visibility"]["student_available"] is True
    assert any(condition["key"] == "search_index_attention" for condition in card["node_status"]["conditions"])


def test_node_status_treats_unsaved_content_as_quality_gap_not_blocker() -> None:
    card = node_card(
        _point_node(has_point_content=False, media_count=1),
        validation={
            "ok": True,
            "errors": [],
            "warnings": [],
        },
    )

    serialized = json.dumps(card["node_status"], ensure_ascii=False)
    assert card["node_status"]["primary_state"] == "needs_content"
    assert "三要素尚未填写" in serialized
    assert card["node_status"]["visibility"]["student_available"] is True
    assert "Canonical point content" not in serialized


def test_node_structure_validation_does_not_warn_on_empty_learning_content() -> None:
    validation = validate_node_payload(_point_node(has_point_content=False), None)

    assert validation["ok"] is True
    assert validation["warnings"] == []


def test_directory_node_status_aggregates_descendant_actionability() -> None:
    card = node_card(
        {
            "node_id": "cat-dir-1",
            "chapter_id": "CH1",
            "parent_id": None,
            "node_kind": "directory",
            "title": "Oxidation categories",
            "summary": "",
            "status": "published",
            "display_order": 1,
            "has_children": True,
            "descendant_point_count": 5,
            "descendant_status_counts": {"needs_content": 1, "needs_video": 2, "sync_attention": 1},
            "has_point_content": False,
            "media_count": 0,
            "published_media_count": 0,
        },
        validation={"ok": True, "errors": [], "warnings": []},
    )

    assert card["node_status"]["primary_state"] == "needs_content"
    assert card["node_status"]["core_readiness"]["descendant_action_count"] == 4
    assert card["node_status"]["core_readiness"]["descendant_status_counts"]["sync_attention"] == 1


def test_point_card_summary_is_derived_from_learning_content_when_node_summary_is_empty() -> None:
    card = node_card(
        _point_node(summary=""),
        content=_complete_content(phenomenon_explanation="The organic layer turns orange.", safety_note="Use ventilation."),
        validation={"ok": True, "errors": [], "warnings": []},
    )

    assert card["summary"] == "The organic layer turns orange."
    assert "point_card_presentation" not in card


def test_video_library_search_contract_is_point_only_with_directory_category_text() -> None:
    search_source = (SERVER_DIR / "app" / "domains" / "video_library" / "search.py").read_text(encoding="utf-8")
    catalog_search_source = (CATALOG_DIR / "search_documents.py").read_text(encoding="utf-8")
    student_source = (CATALOG_DIR / "student_read_models.py").read_text(encoding="utf-8")
    file_source = (CATALOG_DIR / "files.py").read_text(encoding="utf-8")

    assert "WHERE n.node_kind = 'point'" in search_source
    assert "canonical_point_id" in search_source
    assert "placement_node_id" in search_source
    assert "directory_context" in search_source
    assert '"category_text": category_text' in search_source
    assert "teacher_note" not in search_source
    assert "source_chunks" not in search_source
    assert "experiment_video_point_evidence" not in search_source

    assert "SELECT id FROM subtree WHERE node_kind = 'point'" in catalog_search_source
    assert "canonical_point_id" in catalog_search_source
    assert "placement_node_id" in catalog_search_source
    assert '"category_text": category_text' in catalog_search_source
    assert "teacher_note" not in catalog_search_source
    assert "not content or content.get(\"content_status\") != \"published\"" not in catalog_search_source
    assert "content_for_search = (published_content if require_published else content) or" in catalog_search_source
    assert "Point content not available" not in student_source
    assert "published_content = content if content and content.get(\"content_status\") == \"published\" else None" in student_source
    assert "pc.content_status = 'published'" not in file_source


def test_catalog_tree_facade_stays_slim_and_boundaries_are_named() -> None:
    facade_source = (CATALOG_DIR / "tree.py").read_text(encoding="utf-8")
    expected_modules = {
        "common.py": "validate_node_payload",
        "nodes.py": "create_node",
        "directories.py": "create_node_params",
        "points.py": "save_point_content",
        "media_bindings.py": "bind_existing_media",
        "related_links.py": "replace_related_links",
        "search_documents.py": "student_search_document_for_node",
        "student_read_models.py": "student_catalog_node",
        "files.py": "student_media_asset_file",
    }

    assert len(facade_source.splitlines()) <= 80
    assert "def save_point_content" not in facade_source
    assert "def bind_existing_media" not in facade_source
    assert "upload_and_bind" not in facade_source

    for filename, symbol in expected_modules.items():
        source = (CATALOG_DIR / filename).read_text(encoding="utf-8")
        assert symbol in source


def test_related_experiment_defaults_are_same_parent_points_without_debug_limits() -> None:
    source = (CATALOG_DIR / "related_links.py").read_text(encoding="utf-8")

    assert "same_parent_points" in source
    assert "default_scope_label" in source
    assert "sibling.parent_id IS NOT DISTINCT FROM :parent_id" in source
    assert "sibling.node_kind = 'point'" in source
    assert "sibling.status <> 'archived'" in source
    assert "LIMIT 6" not in source
    assert "same_parent_neighborhood" not in source


def test_catalog_point_placement_backend_contracts_are_explicit() -> None:
    nodes_source = (CATALOG_DIR / "nodes.py").read_text(encoding="utf-8")
    points_source = (CATALOG_DIR / "points.py").read_text(encoding="utf-8")
    common_source = (CATALOG_DIR / "common.py").read_text(encoding="utf-8")

    assert "INSERT INTO experiment_catalog_points" in nodes_source
    assert "def copy_node" in nodes_source
    assert "copied_from_node_id" in nodes_source
    assert "copy_root_source_node_id" in nodes_source
    assert "Directory cannot be copied into itself or its descendants" in nodes_source
    assert 'canonical_point_id = clean(data.get("canonical_point_id")) or None' in nodes_source
    assert "Canonical experiment point not found" in nodes_source
    assert "active_placements_for_canonical_point" in nodes_source
    assert "Archiving the final placement requires an explicit canonical archive decision" in nodes_source
    assert "queue_subtree_point_indexes(session, node_id=node_id)" in nodes_source
    assert 'reason="catalog_path_moved"' in nodes_source

    assert "canonical_point_id_for_node(session, node_id)" in points_source
    assert "WHERE canonical_point_id = :canonical_point_id" in points_source
    assert "OR node_id = :node_id" in points_source
    assert "WHERE canonical_point_id = :canonical_point_id\n                  AND node_kind = 'point'" in points_source
    assert "active_placement_ids_for_canonical_point(session, canonical_point_id)" in points_source

    assert "def active_placements_for_canonical_point" in common_source
    assert "def active_placement_ids_for_canonical_point" in common_source
    assert "Point placement must target a canonical experiment point" in common_source
