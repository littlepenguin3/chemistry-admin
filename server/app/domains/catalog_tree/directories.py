from __future__ import annotations

from typing import Any

from server.app.domains.catalog_tree.common import clean, json_dump


DIRECTORY_LAYOUTS = {"default", "compact", "image", "hero"}
POINT_CARD_KEYS = {"cover_image_asset_id", "short_description", "icon_key", "accent", "emphasis"}


def _clean_optional(value: Any) -> str | None:
    text = clean(value)
    return text or None


def normalize_card_layout(value: Any, fallback: str = "default") -> str:
    layout = clean(value) or fallback or "default"
    return layout if layout in DIRECTORY_LAYOUTS else "default"


def normalize_card_presentation(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    allowed: dict[str, Any] = {}
    for key in ("image_position", "badge", "tone", "student_hint"):
        if value.get(key) not in (None, ""):
            allowed[key] = value[key]
    return allowed


def normalize_point_card_presentation(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    allowed: dict[str, Any] = {}
    for key in POINT_CARD_KEYS:
        raw = value.get(key)
        if raw in (None, ""):
            continue
        allowed[key] = bool(raw) if key == "emphasis" else raw
    return allowed


def create_node_params(data: dict[str, Any], *, kind: str) -> dict[str, Any]:
    return {
        "summary": clean(data.get("summary")),
        "teacher_note": clean(data.get("teacher_note")),
        "student_description": clean(data.get("student_description") or data.get("summary")),
        "card_image_asset_id": _clean_optional(data.get("card_image_asset_id")),
        "card_icon_key": _clean_optional(data.get("card_icon_key")),
        "card_accent": _clean_optional(data.get("card_accent")),
        "card_layout": normalize_card_layout(data.get("card_layout")),
        "card_presentation": json_dump(normalize_card_presentation(data.get("card_presentation")) if kind == "directory" else {}),
        "point_card_presentation": json_dump(normalize_point_card_presentation(data.get("point_card_presentation")) if kind == "point" else {}),
    }


def update_node_params(data: dict[str, Any], current: dict[str, Any], *, kind: str) -> dict[str, Any]:
    def value(name: str, default: Any = "") -> Any:
        return data[name] if name in data else current.get(name, default)

    summary = clean(value("summary", current.get("summary", "")))
    student_description = clean(value("student_description", current.get("student_description") or summary))
    if not student_description:
        student_description = summary
    return {
        "summary": summary,
        "teacher_note": clean(value("teacher_note", current.get("teacher_note", ""))),
        "student_description": student_description,
        "card_image_asset_id": _clean_optional(value("card_image_asset_id", current.get("card_image_asset_id"))),
        "card_icon_key": _clean_optional(value("card_icon_key", current.get("card_icon_key"))),
        "card_accent": _clean_optional(value("card_accent", current.get("card_accent"))),
        "card_layout": normalize_card_layout(value("card_layout", current.get("card_layout", "default")), current.get("card_layout", "default")),
        "card_presentation": json_dump(normalize_card_presentation(value("card_presentation", current.get("card_presentation"))) if kind == "directory" else {}),
        "point_card_presentation": json_dump(
            normalize_point_card_presentation(value("point_card_presentation", current.get("point_card_presentation"))) if kind == "point" else {}
        ),
    }
