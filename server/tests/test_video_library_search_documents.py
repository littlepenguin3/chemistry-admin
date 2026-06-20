from __future__ import annotations

from server.app.domains.video_library.search import LocalVideoLibrarySearchAdapter, _build_documents


def test_directory_category_text_matches_descendant_point_without_directory_documents() -> None:
    documents = _build_documents(
        [],
        profiles=[
            {
                "enabled": True,
                "profile_id": "halogens-17",
                "chapter_id": "CH17",
                "title": "Halogens",
                "family_name": "Halogens",
                "element_symbols": ["Cl", "Br"],
            }
        ],
        point_rows=[
            {
                "node_id": "cat-point-halogen",
                "chapter_id": "CH17",
                "chapter_title": "Halogen chapter",
                "node_title": "Orange layer observation",
                "point_title": "Orange layer observation",
                "principle_mode": "equation",
                "principle_equation": "Cl2 + 2Br- = 2Cl- + Br2",
                "principle_text": None,
                "phenomenon_explanation": "The organic layer turns orange.",
                "safety_note": "Use ventilation.",
                "catalog_path": ["Halogen displacement", "Oxidation experiments", "Orange layer observation"],
                "directory_context": [
                    {
                        "title": "Oxidation experiments",
                        "student_description": "Directory category for displacement verification",
                        "card_icon_key": "flask",
                        "card_accent": "green",
                    }
                ],
                "related_links": [],
                "videos": [{"media_id": "media-1", "title": "Bound ready video"}],
                "content_updated_at": None,
            }
        ],
    )

    matches = LocalVideoLibrarySearchAdapter().search("displacement verification", documents, 10)

    assert [document.id for document in documents] == ["cat-point-halogen"]
    assert matches and matches[0].id == "cat-point-halogen"
    assert matches[0].result_type == "video_point"
    assert matches[0].target is not None
    assert matches[0].target.kind == "point_detail"
    assert matches[0].index_source is not None
    assert "Directory category for displacement verification" in matches[0].index_source["category_text"]
