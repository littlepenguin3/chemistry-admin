from __future__ import annotations

from typing import Any


def _clean(value: Any) -> str:
    return str(value or "").strip()


def default_related_links(points: list[dict[str, Any]], point_key: str) -> list[dict[str, Any]]:
    index = next((idx for idx, point in enumerate(points) if point["point_key"] == point_key), -1)
    if index < 0:
        return []
    nearby = [idx for idx in (index - 1, index + 1) if 0 <= idx < len(points)]
    result: list[dict[str, Any]] = []
    for sort_order, point_index in enumerate(nearby, start=1):
        target = points[point_index]
        result.append(
            {
                "id": None,
                "source": "default",
                "relation_type": "default",
                "hidden": False,
                "sort_order": sort_order,
                "label": None,
                "target_experiment_id": target["experiment_id"],
                "target_point_key": target["point_key"],
                "target_point_title": target["point_title"],
                "target_experiment_title": None,
            }
        )
    return result


def merge_related_links(
    *,
    points: list[dict[str, Any]],
    point_key: str,
    manual_links: list[dict[str, Any]],
    include_hidden: bool,
) -> list[dict[str, Any]]:
    defaults = default_related_links(points, point_key)
    default_keys = {(link["target_experiment_id"], link["target_point_key"]) for link in defaults}
    overrides = {
        (link["target_experiment_id"], link["target_point_key"]): link
        for link in manual_links
        if link.get("relation_type") == "default_override"
    }
    result: list[dict[str, Any]] = []
    for link in defaults:
        override = overrides.get((link["target_experiment_id"], link["target_point_key"]))
        if override:
            if override.get("hidden") and not include_hidden:
                continue
            link = {
                **link,
                "id": str(override["id"]),
                "source": "default_override",
                "hidden": bool(override.get("hidden")),
                "sort_order": int(override.get("sort_order") or link["sort_order"]),
                "label": override.get("label"),
            }
        result.append(link)
    for link in manual_links:
        key = (link["target_experiment_id"], link["target_point_key"])
        if link.get("relation_type") == "default_override" and key in default_keys:
            continue
        if link.get("hidden") and not include_hidden:
            continue
        result.append(
            {
                "id": str(link["id"]),
                "source": "manual",
                "relation_type": link.get("relation_type") or "manual",
                "hidden": bool(link.get("hidden")),
                "sort_order": int(link.get("sort_order") or 0),
                "label": link.get("label"),
                "target_experiment_id": link["target_experiment_id"],
                "target_point_key": link["target_point_key"],
                "target_point_title": link.get("target_point_title"),
                "target_experiment_title": link.get("target_experiment_title"),
            }
        )
    return sorted(result, key=lambda item: (int(item.get("sort_order") or 0), _clean(item.get("target_point_title"))))
