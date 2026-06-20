from __future__ import annotations

import json
from pathlib import Path

from server.app.domains.catalog_tree.common import node_card, node_select, row_dict
from server.app.domains.catalog_tree.directories import create_node_params, normalize_point_card_presentation


SERVER_DIR = Path(__file__).resolve().parents[1]
CATALOG_DIR = SERVER_DIR / "app" / "domains" / "catalog_tree"


def test_directory_card_payload_is_student_visible_but_teacher_note_is_not() -> None:
    params = create_node_params(
        {
            "summary": " Teacher summary ",
            "teacher_note": " private author note ",
            "student_description": " student-facing card ",
            "card_image_asset_id": " asset-1 ",
            "card_icon_key": " flask ",
            "card_accent": " green ",
            "card_layout": "compact",
            "card_presentation": {"badge": "Lab", "internal": "ignored"},
            "point_card_presentation": {"short_description": "ignored for directory"},
        },
        kind="directory",
    )

    assert params["summary"] == "Teacher summary"
    assert params["teacher_note"] == "private author note"
    assert params["student_description"] == "student-facing card"
    assert params["card_image_asset_id"] == "asset-1"
    assert params["card_icon_key"] == "flask"
    assert params["card_accent"] == "green"
    assert params["card_layout"] == "compact"
    assert json.loads(params["card_presentation"]) == {"badge": "Lab"}
    assert json.loads(params["point_card_presentation"]) == {}

    card = node_card(
        {
            "node_id": "cat-dir-1",
            "chapter_id": "CH1",
            "parent_id": None,
            "node_kind": "directory",
            "title": "Oxidation categories",
            "summary": "Teacher summary",
            "teacher_note": "private author note",
            "student_description": "student-facing card",
            "card_layout": "compact",
            "card_presentation": {"badge": "Lab"},
            "point_card_presentation": {},
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
    assert card["student_description"] == "student-facing card"
    assert card["card_presentation"] == {"badge": "Lab"}
    assert card["descendant_point_count"] == 0
    assert "teacher_note" not in card


def test_catalog_node_card_exposes_recursive_point_count_contract() -> None:
    directory_row = row_dict(
        {
            "node_id": "cat-dir-1",
            "chapter_id": "CH1",
            "parent_id": None,
            "node_kind": "directory",
            "title": "Oxidation categories",
            "summary": "",
            "student_description": "",
            "card_presentation": {},
            "point_card_presentation": {},
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
            "student_description": "",
            "card_presentation": {},
            "point_card_presentation": {},
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


def test_point_card_payload_is_constrained_and_does_not_inherit_directory_layout() -> None:
    params = create_node_params(
        {
            "summary": "Point summary",
            "student_description": "Point summary",
            "card_layout": "hero",
            "card_presentation": {"badge": "ignored for point"},
            "point_card_presentation": {
                "cover_image_asset_id": "asset-cover",
                "short_description": "Watch the color change",
                "icon_key": "play",
                "accent": "blue",
                "emphasis": "yes",
                "layout": "not allowed",
            },
        },
        kind="point",
    )

    point_card = json.loads(params["point_card_presentation"])
    assert json.loads(params["card_presentation"]) == {}
    assert point_card == {
        "cover_image_asset_id": "asset-cover",
        "short_description": "Watch the color change",
        "icon_key": "play",
        "accent": "blue",
        "emphasis": True,
    }
    assert normalize_point_card_presentation({"short_description": "", "layout": "wide"}) == {}


def test_video_library_search_contract_is_point_only_with_directory_category_text() -> None:
    search_source = (SERVER_DIR / "app" / "domains" / "video_library" / "search.py").read_text(encoding="utf-8")
    catalog_search_source = (CATALOG_DIR / "search_documents.py").read_text(encoding="utf-8")

    assert "WHERE n.node_kind = 'point'" in search_source
    assert "AND target.node_kind = 'point'" in search_source
    assert "directory_context" in search_source
    assert '"category_text": category_text' in search_source
    assert "teacher_note" not in search_source
    assert "source_chunks" not in search_source
    assert "experiment_video_point_evidence" not in search_source

    assert "SELECT id FROM subtree WHERE node_kind = 'point'" in catalog_search_source
    assert '"category_text": category_text' in catalog_search_source
    assert "teacher_note" not in catalog_search_source


def test_catalog_tree_facade_stays_slim_and_boundaries_are_named() -> None:
    facade_source = (CATALOG_DIR / "tree.py").read_text(encoding="utf-8")
    expected_modules = {
        "common.py": "validate_node_payload",
        "nodes.py": "create_node",
        "directories.py": "normalize_card_presentation",
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
