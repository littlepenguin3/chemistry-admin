from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from sqlalchemy import text

from server.app.domains.media.visibility import is_student_visible_media
from server.app.domains.experiment_points.canonical_points import candidate_point_key
from server.app.infrastructure.settings import ROOT
from server.app.normalization import CHAPTER_AREA_MAP


AREA_ORDER = ["p", "s", "ds", "d", "f"]
AREA_NAMES = {
    "p": "p区",
    "s": "s区",
    "ds": "ds区",
    "d": "d区",
    "f": "f区",
}
PROFILE_SEED_PATH = ROOT / "data" / "seed" / "student_learning" / "element_profiles.json"


@dataclass(frozen=True)
class ParentGroup:
    parent_code: str
    parent_title: str
    area_id: str
    area_name: str
    chapter_ids: tuple[str, ...]
    display_order: int
    experiments: tuple[dict[str, Any], ...]


def student_id(user: Any) -> str:
    return str(user.student_id or user.username).strip().upper()


def metadata(experiment: dict[str, Any]) -> dict[str, Any]:
    value = experiment.get("metadata")
    return value if isinstance(value, dict) else {}


def chapter_bindings(experiment: dict[str, Any]) -> list[dict[str, Any]]:
    value = experiment.get("chapter_bindings") or []
    return [item for item in value if isinstance(item, dict)]


def parent_code(experiment: dict[str, Any]) -> str:
    return str(metadata(experiment).get("parent_code") or experiment.get("code") or experiment.get("id"))


def parent_title(experiment: dict[str, Any]) -> str:
    return str(metadata(experiment).get("parent_title") or experiment.get("title") or parent_code(experiment))


def module_title(experiment: dict[str, Any]) -> str | None:
    value = metadata(experiment).get("module_display_title") or metadata(experiment).get("module_title")
    return str(value) if value else None


def video_candidates(experiment: dict[str, Any]) -> list[str]:
    raw = metadata(experiment).get("video_candidates") or []
    if not isinstance(raw, list):
        return []
    candidates: list[str] = []
    seen: set[str] = set()
    for item in raw:
        title = str(item or "").strip()
        if title and title not in seen:
            candidates.append(title)
            seen.add(title)
    return candidates


@lru_cache(maxsize=1)
def student_learning_seed() -> dict[str, Any]:
    return json.loads(PROFILE_SEED_PATH.read_text(encoding="utf-8-sig"))


def learning_profiles() -> list[dict[str, Any]]:
    data = student_learning_seed()
    profiles = [item for item in data.get("profiles") or [] if isinstance(item, dict)]
    return sorted(profiles, key=lambda item: (int(item.get("display_order") or 999), str(item.get("profile_id") or "")))


def media_resources(experiment: dict[str, Any], *, visible_only: bool = False) -> list[dict[str, Any]]:
    resources = experiment.get("media_resources") or []
    items = [item for item in resources if isinstance(item, dict)]
    if not visible_only:
        return items
    return [
        item
        for item in items
        if is_student_visible_media(str(item.get("upload_status") or ""), str(item.get("binding_status") or ""))
    ]


def experiment_chapter_ids(experiment: dict[str, Any]) -> tuple[str, ...]:
    ids: list[str] = []
    seen: set[str] = set()
    for binding in chapter_bindings(experiment):
        chapter_id = str(binding.get("chapter_id") or "").strip()
        if chapter_id and chapter_id not in seen:
            ids.append(chapter_id)
            seen.add(chapter_id)
    return tuple(ids)


def chapter_area_id(chapter_id: str | None) -> str | None:
    if not chapter_id:
        return None
    chapter = CHAPTER_AREA_MAP.get(str(chapter_id))
    return str(chapter["area_id"]) if chapter else None


def chapter_area_name(area_id: str) -> str:
    return AREA_NAMES.get(area_id, area_id)


def experiment_area_id(experiment: dict[str, Any]) -> str | None:
    bindings = sorted(
        chapter_bindings(experiment),
        key=lambda item: (
            0 if item.get("coverage_type") == "primary" else 1,
            int(item.get("sort_order") or 999),
            str(item.get("chapter_id") or ""),
        ),
    )
    for binding in bindings:
        area_id = chapter_area_id(str(binding.get("chapter_id") or ""))
        if area_id in AREA_NAMES:
            return area_id
    return None


def build_parent_groups(experiments: list[dict[str, Any]]) -> list[ParentGroup]:
    buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for experiment in experiments:
        area_id = experiment_area_id(experiment)
        if area_id not in AREA_NAMES or area_id == "f":
            continue
        buckets[(area_id, parent_code(experiment))].append(experiment)

    groups: list[ParentGroup] = []
    for (area_id, code), items in buckets.items():
        ordered_items = sorted(items, key=lambda item: (int(item.get("display_order") or 999), str(item.get("code") or "")))
        chapter_ids: list[str] = []
        seen_chapters: set[str] = set()
        for item in ordered_items:
            for chapter_id in experiment_chapter_ids(item):
                if chapter_id not in seen_chapters:
                    chapter_ids.append(chapter_id)
                    seen_chapters.add(chapter_id)
        groups.append(
            ParentGroup(
                parent_code=code,
                parent_title=parent_title(ordered_items[0]),
                area_id=area_id,
                area_name=chapter_area_name(area_id),
                chapter_ids=tuple(chapter_ids),
                display_order=min(int(item.get("display_order") or 999) for item in ordered_items),
                experiments=tuple(ordered_items),
            )
        )
    area_index = {area_id: index for index, area_id in enumerate(AREA_ORDER)}
    return sorted(groups, key=lambda group: (area_index.get(group.area_id, 99), group.display_order, group.parent_code))


def student_experiment_sql(where_clause: str = "") -> str:
    return f"""
        SELECT
          fe.id,
          fe.code,
          fe.title,
          fe.summary,
          fe.status,
          fe.display_order,
          fe.metadata,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'chapter_id', ecb.chapter_id,
                'chapter_title', c.chapter_title,
                'chapter_number', c.chapter_number,
                'coverage_type', ecb.coverage_type,
                'sort_order', ecb.sort_order
              )
              ORDER BY ecb.sort_order, c.chapter_number NULLS LAST, ecb.chapter_id
            )
            FROM experiment_chapter_bindings ecb
            LEFT JOIN chapters c ON c.id = ecb.chapter_id
            WHERE ecb.experiment_id = fe.id
          ), '[]'::jsonb) AS chapter_bindings,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'media_id', ma.id,
                'title', COALESCE(mb.title, ma.title),
                'mime_type', COALESCE(ma.playback_mime_type, ma.mime_type),
                'upload_status', ma.upload_status,
                'binding_status', mb.status,
                'point_key', mb.metadata->>'point_key',
                'point_title', mb.metadata->>'point_title',
                'has_thumbnail', ma.thumbnail_relative_path IS NOT NULL
              )
              ORDER BY mb.sort_order, mb.created_at
            )
            FROM media_bindings mb
            JOIN media_assets ma ON ma.id = mb.media_asset_id
            WHERE mb.target_type = 'experiment'
              AND mb.target_id = fe.id
              AND mb.status <> 'archived'
          ), '[]'::jsonb) AS media_resources,
          (SELECT COUNT(*) FROM experiment_questions q WHERE q.experiment_id = fe.id AND q.status = 'published') AS published_question_count
        FROM formal_experiments fe
        {where_clause}
        ORDER BY fe.display_order, fe.code
    """


def load_published_experiments(session: Any) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            student_experiment_sql(
                """
                WHERE fe.status = 'published'
                  AND COALESCE(fe.metadata->>'archived_by_catalog_seed', 'false') <> 'true'
                """
            )
        )
    ).mappings()
    return [dict(row) for row in rows]


def experiment_search_text(experiment: dict[str, Any]) -> str:
    data = metadata(experiment)
    parts = [
        experiment.get("code"),
        experiment.get("title"),
        experiment.get("summary"),
        data.get("parent_code"),
        data.get("parent_title"),
        data.get("module_title"),
        data.get("module_display_title"),
        data.get("outline_group"),
        *video_candidates(experiment),
    ]
    return " ".join(str(part or "") for part in parts).lower()


def profile_experiments(profile: dict[str, Any], experiments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chapter_id = str(profile.get("chapter_id") or "").strip()
    matched = [experiment for experiment in experiments if chapter_id and chapter_id in experiment_chapter_ids(experiment)]
    if matched:
        return matched
    keywords = [
        str(item).strip().lower()
        for section in profile.get("property_sections") or []
        if isinstance(section, dict)
        for item in section.get("experiment_keywords") or []
        if str(item).strip()
    ]
    if not keywords:
        return []
    return [
        experiment
        for experiment in experiments
        if any(keyword in experiment_search_text(experiment) for keyword in keywords)
    ]


def candidate_point(experiment: dict[str, Any]) -> tuple[str | None, str | None]:
    for media in media_resources(experiment, visible_only=True):
        point_key = str(media.get("point_key") or "").strip()
        point_title = str(media.get("point_title") or media.get("title") or "").strip()
        if point_key or point_title:
            return point_key or point_title, point_title or point_key
    candidates = video_candidates(experiment)
    if candidates:
        return candidate_point_key(0, candidates[0]), candidates[0]
    return None, None
