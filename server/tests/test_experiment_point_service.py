from __future__ import annotations

from typing import Any

from server.app.domains.experiment_points.index_events import queue_point_search_index_for_media_binding
from server.app.domains.experiment_points.learning_content import validate_point_content


class _Result:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "_Result":
        return self

    def first(self) -> dict[str, Any] | None:
        return self.row


class _FakeSession:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row
        self.calls: list[dict[str, Any]] = []

    def execute(self, _statement: Any, params: dict[str, Any] | None = None) -> _Result:
        self.calls.append(params or {})
        if len(self.calls) == 1:
            return _Result(self.row)
        return _Result(None)


def test_point_content_validation_requires_exact_primary_principle_and_safety() -> None:
    invalid = validate_point_content(
        {
            "principle_mode": "equation",
            "principle_equation": "",
            "principle_text": "secondary text should not be primary",
            "phenomenon_explanation": "",
            "safety_note": "",
            "content_status": "draft",
        },
        experiment_status="draft",
    )

    assert invalid["complete"] is False
    assert "Equation-mode principle is required before publishing" in invalid["errors"]
    assert "Equation mode cannot use principle text as the primary principle" in invalid["errors"]
    assert "Phenomenon explanation is required before publishing" in invalid["errors"]
    assert "Safety note is required before publishing" in invalid["errors"]
    assert "Parent experiment must be published before point content is published" in invalid["errors"]


def test_point_content_validation_accepts_complete_text_mode() -> None:
    valid = validate_point_content(
        {
            "principle_mode": "text",
            "principle_equation": "",
            "principle_text": "硫代硫酸钠在酸性条件下不稳定。",
            "phenomenon_explanation": "生成硫沉淀和二氧化硫。",
            "safety_note": "在通风条件下操作。",
            "content_status": "published",
        },
        experiment_status="published",
    )

    assert valid == {"complete": True, "errors": [], "warnings": []}


def test_media_binding_change_queues_upsert_for_published_point_content() -> None:
    session = _FakeSession(
        {
            "point_status": "active",
            "experiment_status": "published",
            "content_status": "published",
        }
    )

    queue_point_search_index_for_media_binding(
        session,
        {
            "target_type": "experiment",
            "target_id": "EXP_19_1_01",
            "metadata": {"point_key": "orange-layer"},
        },
    )

    assert session.calls[-1]["experiment_id"] == "EXP_19_1_01"
    assert session.calls[-1]["point_key"] == "orange-layer"
    assert session.calls[-1]["desired_action"] == "upsert"


def test_media_binding_change_queues_delete_for_unpublished_point_content() -> None:
    session = _FakeSession(
        {
            "point_status": "active",
            "experiment_status": "published",
            "content_status": "draft",
        }
    )

    queue_point_search_index_for_media_binding(
        session,
        {
            "target_type": "experiment",
            "target_id": "EXP_19_1_01",
            "metadata": {"point_key": "orange-layer"},
        },
    )

    assert session.calls[-1]["desired_action"] == "delete"
