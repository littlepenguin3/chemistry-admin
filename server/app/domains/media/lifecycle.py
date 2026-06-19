from __future__ import annotations

from typing import Any

from sqlalchemy import text

from server.app.domains.media.assets import list_media_assets
from server.app.infrastructure.database import db_session
from server.app.infrastructure.settings import get_settings


def media_dependency_counts(limit: int) -> dict[str, dict[str, int]]:
    with db_session() as session:
        rows = session.execute(
            text(
                """
                SELECT ma.id,
                       (
                         SELECT COUNT(*) FROM media_bindings mb
                         WHERE mb.media_asset_id = ma.id
                       ) AS binding_count,
                       (
                         SELECT COUNT(*) FROM media_bindings mb
                         WHERE mb.media_asset_id = ma.id
                           AND mb.status <> 'archived'
                       ) AS active_binding_count,
                       (
                         SELECT COUNT(*) FROM media_processing_jobs mpj
                         WHERE mpj.media_asset_id = ma.id
                       ) AS processing_job_count,
                       (
                         SELECT COUNT(*) FROM media_renditions mr
                         WHERE mr.media_asset_id = ma.id
                       ) AS rendition_count,
                       (
                         SELECT COUNT(*) FROM media_video_fingerprints mvf
                         WHERE mvf.media_asset_id = ma.id
                       ) AS fingerprint_count,
                       (
                         SELECT COUNT(*) FROM media_duplicate_candidates mdc
                         WHERE mdc.media_asset_id = ma.id
                            OR mdc.candidate_asset_id = ma.id
                       ) AS duplicate_candidate_count
                FROM media_assets ma
                ORDER BY ma.created_at DESC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()
    return {
        str(row["id"]): {
            "binding_count": int(row["binding_count"] or 0),
            "active_binding_count": int(row["active_binding_count"] or 0),
            "processing_job_count": int(row["processing_job_count"] or 0),
            "rendition_count": int(row["rendition_count"] or 0),
            "fingerprint_count": int(row["fingerprint_count"] or 0),
            "duplicate_candidate_count": int(row["duplicate_candidate_count"] or 0),
        }
        for row in rows
    }


def media_cleanup_action(asset: dict[str, Any], dependencies: dict[str, int]) -> str:
    if dependencies.get("active_binding_count", 0) > 0:
        return "keep_active_binding"
    if asset.get("upload_status") == "ready":
        return "keep_ready_asset_without_binding"
    if asset.get("file_state") == "missing":
        return "review_missing_file_record"
    if asset.get("upload_status") in {"failed", "replaced"}:
        return "manual_archive_or_delete_candidate"
    return "review_before_cleanup"


def media_referenced_paths() -> set[str]:
    with db_session() as session:
        rows = session.execute(
            text(
                """
                SELECT relative_path AS path FROM media_assets WHERE relative_path IS NOT NULL
                UNION
                SELECT source_relative_path AS path FROM media_assets WHERE source_relative_path IS NOT NULL
                UNION
                SELECT playback_relative_path AS path FROM media_assets WHERE playback_relative_path IS NOT NULL
                UNION
                SELECT thumbnail_relative_path AS path FROM media_assets WHERE thumbnail_relative_path IS NOT NULL
                UNION
                SELECT relative_path AS path FROM media_renditions WHERE relative_path IS NOT NULL
                """
            )
        ).scalars().all()
    return {str(path).strip().replace("\\", "/") for path in rows if str(path or "").strip()}


def orphan_media_files(referenced_paths: set[str], limit: int) -> tuple[list[dict[str, Any]], int, int]:
    root = get_settings().media_root.resolve()
    if not root.exists():
        return [], 0, 0
    output: list[dict[str, Any]] = []
    total_count = 0
    total_bytes = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative_path = path.relative_to(root).as_posix()
        if relative_path in referenced_paths:
            continue
        try:
            size = path.stat().st_size
        except OSError:
            size = 0
        total_count += 1
        total_bytes += size
        if len(output) < limit:
            output.append({"relative_path": relative_path, "file_size_bytes": size})
    return output, total_count, total_bytes


def media_cleanup_dry_run(*, limit: int = 500, orphan_limit: int = 200) -> dict[str, Any]:
    assets = list_media_assets(limit=limit)["items"]
    dependencies_by_id = media_dependency_counts(limit)
    referenced_paths = media_referenced_paths()
    orphan_files, orphan_total_count, orphan_total_bytes = orphan_media_files(referenced_paths, orphan_limit)
    asset_items = []
    for asset in assets:
        dependencies = dependencies_by_id.get(str(asset["id"]), {})
        existing_bytes = sum(int(item.get("file_size_bytes") or 0) for item in asset.get("media_files") or [])
        asset_items.append(
            {
                "id": str(asset["id"]),
                "title": asset.get("title"),
                "original_file_name": asset.get("original_file_name"),
                "upload_status": asset.get("upload_status"),
                "file_state": asset.get("file_state"),
                "primary_file_available": asset.get("primary_file_available"),
                "existing_file_count": asset.get("existing_file_count"),
                "missing_file_count": asset.get("missing_file_count"),
                "existing_file_bytes": existing_bytes,
                "dependencies": dependencies,
                "action": media_cleanup_action(asset, dependencies),
                "media_files": asset.get("media_files") or [],
            }
        )
    return {
        "dry_run": True,
        "media_root": str(get_settings().media_root),
        "asset_count": len(asset_items),
        "asset_limit": limit,
        "referenced_path_count": len(referenced_paths),
        "orphan_file_count": orphan_total_count,
        "orphan_file_bytes": orphan_total_bytes,
        "orphan_files_returned": len(orphan_files),
        "orphan_files": orphan_files,
        "assets": asset_items,
        "policy": {
            "asset_file_deletion": "refused_without_archive_or_tombstone_state",
            "orphan_file_deletion": "allowed_only_for_files_not_referenced_by_media_database_rows",
        },
    }
