from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import bindparam, text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.domains.media.files import checksum_sha256_file
from server.app.infrastructure.database import apply_migrations, db_session
from server.app.infrastructure.settings import get_settings

DEFAULT_MANIFEST_PATH = ROOT / "data" / "seed" / "media" / "experiment_video_seed_v1.json"
SEED_TYPE = "experiment_video_media_seed"
SEED_VERSION = 1


def _json_param(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False, default=str)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_source_path(relative_path: str) -> Path:
    path = (ROOT / relative_path).resolve()
    seed_root = (ROOT / "data" / "seed").resolve()
    if seed_root != path and seed_root not in path.parents:
        raise ValueError(f"Seed source path escapes data/seed: {relative_path}")
    if not path.exists():
        raise FileNotFoundError(path)
    return path


def _safe_media_destination(media_root: Path, relative_path: str) -> Path:
    candidate = Path(relative_path)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError(f"Unsafe media relative path: {relative_path}")
    root = media_root.resolve()
    path = (root / candidate).resolve()
    if root != path and root not in path.parents:
        raise ValueError(f"Media destination escapes MEDIA_ROOT: {relative_path}")
    return path


def _copy_seed_file(source: Path, destination: Path, expected_sha256: str) -> bool:
    if destination.exists() and checksum_sha256_file(destination) == expected_sha256:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.tmp-seed-{os.getpid()}")
    shutil.copy2(source, temporary)
    os.replace(temporary, destination)
    return True


def load_manifest(path: Path = DEFAULT_MANIFEST_PATH) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    if payload.get("seed_type") != SEED_TYPE:
        raise ValueError(f"{path} seed_type must be {SEED_TYPE!r}")
    if int(payload.get("version") or 0) != SEED_VERSION:
        raise ValueError(f"{path} version must be {SEED_VERSION}")
    if not isinstance(payload.get("assets"), list):
        raise ValueError(f"{path} assets must be a list")
    if not isinstance(payload.get("bindings"), list):
        raise ValueError(f"{path} bindings must be a list")
    return payload


def validate_manifest_payload(payload: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    assets = [item for item in payload.get("assets") or [] if isinstance(item, dict)]
    bindings = [item for item in payload.get("bindings") or [] if isinstance(item, dict)]
    asset_ids: set[str] = set()
    relative_paths: set[str] = set()
    for index, asset in enumerate(assets, start=1):
        asset_id = str(asset.get("id") or "").strip()
        if not asset_id:
            errors.append(f"assets[{index}].id is required")
        elif asset_id in asset_ids:
            errors.append(f"assets[{index}].id duplicates {asset_id}")
        asset_ids.add(asset_id)
        source_path = str(asset.get("seed_source_path") or "").strip()
        target_path = str(asset.get("target_relative_path") or asset.get("relative_path") or "").strip()
        if not source_path:
            errors.append(f"assets[{index}].seed_source_path is required")
        else:
            try:
                source = _safe_source_path(source_path)
                if int(asset.get("file_size_bytes") or -1) != source.stat().st_size:
                    errors.append(f"assets[{index}].file_size_bytes does not match {source_path}")
                expected_sha = str(asset.get("checksum_sha256") or "")
                if expected_sha and checksum_sha256_file(source) != expected_sha:
                    errors.append(f"assets[{index}].checksum_sha256 does not match {source_path}")
            except Exception as exc:
                errors.append(f"assets[{index}].seed_source_path invalid: {exc}")
        if not target_path:
            errors.append(f"assets[{index}].target_relative_path is required")
        elif target_path in relative_paths:
            errors.append(f"assets[{index}].target_relative_path duplicates {target_path}")
        relative_paths.add(target_path)
        if asset.get("upload_status") != "ready":
            errors.append(f"assets[{index}].upload_status must be ready")
        if asset.get("kind") not in {"real_video", "placeholder_video"}:
            errors.append(f"assets[{index}].kind must be real_video or placeholder_video")
    coverage_keys: set[str] = set()
    for index, binding in enumerate(bindings, start=1):
        node_id = str(binding.get("node_id") or "").strip()
        canonical_point_id = str(binding.get("canonical_point_id") or "").strip()
        media_asset_id = str(binding.get("media_asset_id") or "").strip()
        coverage_key = canonical_point_id or node_id
        if not node_id:
            errors.append(f"bindings[{index}].node_id is required")
        if not coverage_key:
            errors.append(f"bindings[{index}] has no node or canonical coverage key")
        elif coverage_key in coverage_keys:
            errors.append(f"bindings[{index}] duplicates coverage key {coverage_key}")
        coverage_keys.add(coverage_key)
        if media_asset_id not in asset_ids:
            errors.append(f"bindings[{index}].media_asset_id references unknown asset {media_asset_id}")
        if binding.get("coverage_kind") not in {"real_video", "placeholder_video"}:
            errors.append(f"bindings[{index}].coverage_kind must be real_video or placeholder_video")
        covered = binding.get("covered_placement_node_ids")
        if not isinstance(covered, list) or not covered:
            errors.append(f"bindings[{index}].covered_placement_node_ids must be a non-empty list")
    expected = payload.get("expected_counts") or {}
    if expected.get("media_assets") is not None and len(assets) != int(expected["media_assets"]):
        errors.append(f"assets: expected {expected['media_assets']}, got {len(assets)}")
    if expected.get("active_point_media_bindings") is not None and len(bindings) != int(expected["active_point_media_bindings"]):
        errors.append(f"bindings: expected {expected['active_point_media_bindings']}, got {len(bindings)}")
    return {
        "ok": not errors,
        "errors": errors,
        "summary": {
            "assets": len(assets),
            "bindings": len(bindings),
            "real_video_bindings": sum(1 for item in bindings if item.get("coverage_kind") == "real_video"),
            "placeholder_video_bindings": sum(1 for item in bindings if item.get("coverage_kind") == "placeholder_video"),
        },
    }


def validate_manifest_references(session: Any, payload: dict[str, Any]) -> dict[str, Any]:
    bindings = [item for item in payload.get("bindings") or [] if isinstance(item, dict)]
    node_ids = {str(item.get("node_id") or "").strip() for item in bindings}
    canonical_point_ids = {
        str(item.get("canonical_point_id") or "").strip()
        for item in bindings
        if str(item.get("canonical_point_id") or "").strip()
    }
    rows = session.execute(
        text(
            """
            SELECT id, canonical_point_id, node_kind, status
            FROM experiment_catalog_nodes
            WHERE id IN :node_ids
            """
        ).bindparams(bindparam("node_ids", expanding=True)),
        {"node_ids": sorted(node_ids)},
    ).mappings().all()
    existing_nodes = {str(row["id"]): dict(row) for row in rows}
    point_rows = session.execute(
        text("SELECT id FROM experiment_catalog_points WHERE id IN :point_ids").bindparams(
            bindparam("point_ids", expanding=True)
        ),
        {"point_ids": sorted(canonical_point_ids)},
    ).all()
    existing_points = {str(row[0]) for row in point_rows}
    errors: list[str] = []
    for binding in bindings:
        node_id = str(binding.get("node_id") or "").strip()
        canonical_point_id = str(binding.get("canonical_point_id") or "").strip()
        node = existing_nodes.get(node_id)
        if not node:
            errors.append(f"{node_id}: missing catalog node")
            continue
        if node.get("node_kind") != "point":
            errors.append(f"{node_id}: binding target is not a point")
        if node.get("status") == "archived":
            errors.append(f"{node_id}: binding target is archived")
        if canonical_point_id and canonical_point_id != str(node.get("canonical_point_id") or ""):
            errors.append(f"{node_id}: canonical point id mismatch")
    missing_points = sorted(canonical_point_ids - existing_points)
    for canonical_point_id in missing_points:
        errors.append(f"{canonical_point_id}: missing canonical point")
    return {
        "ok": not errors,
        "errors": errors,
        "summary": {
            "node_ids": len(node_ids),
            "canonical_point_ids": len(canonical_point_ids),
            "missing_nodes": len(node_ids - set(existing_nodes)),
            "missing_canonical_points": len(missing_points),
        },
    }


def _restore_files(payload: dict[str, Any], media_root: Path, *, dry_run: bool = False) -> dict[str, Any]:
    restored = 0
    verified = 0
    files: list[dict[str, Any]] = []
    for asset in payload.get("assets") or []:
        if not isinstance(asset, dict):
            continue
        source = _safe_source_path(str(asset.get("seed_source_path") or ""))
        relative_path = str(asset.get("target_relative_path") or asset.get("relative_path") or "")
        destination = _safe_media_destination(media_root, relative_path)
        expected_sha = str(asset.get("checksum_sha256") or "")
        if checksum_sha256_file(source) != expected_sha:
            raise ValueError(f"Seed source checksum mismatch: {asset.get('seed_source_path')}")
        if int(asset.get("file_size_bytes") or -1) != source.stat().st_size:
            raise ValueError(f"Seed source size mismatch: {asset.get('seed_source_path')}")
        changed = False if dry_run else _copy_seed_file(source, destination, expected_sha)
        restored += 1 if changed else 0
        verified += 0 if changed else 1
        files.append(
            {
                "asset_id": asset.get("id"),
                "source": str(asset.get("seed_source_path")),
                "relative_path": relative_path,
                "absolute_path": str(destination),
                "changed": changed,
            }
        )
    return {"media_root": str(media_root), "restored": restored, "verified": verified, "files": files}


def _seed_metadata(payload: dict[str, Any], metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    result = dict(metadata or {})
    result.update(
        {
            "seed_owned": True,
            "seed_type": SEED_TYPE,
            "seed_version": payload.get("seed_version") or "experiment-videos-new-v1",
            "seeded_at": _iso_now(),
        }
    )
    return result


def _upsert_media_asset(session: Any, payload: dict[str, Any], asset: dict[str, Any]) -> None:
    metadata = _seed_metadata(payload, asset.get("metadata") if isinstance(asset.get("metadata"), dict) else {})
    session.execute(
        text(
            """
            INSERT INTO media_assets (
              id, title, original_file_name, relative_path, source_relative_path,
              playback_relative_path, checksum_sha256, mime_type, playback_mime_type,
              file_size_bytes, duration_seconds, width, height, fps, bitrate,
              video_codec, audio_codec, upload_status, lifecycle_status,
              processing_phase, processing_progress, processed_at, metadata, updated_at
            )
            VALUES (
              CAST(:id AS uuid), :title, :original_file_name, :relative_path, :source_relative_path,
              :playback_relative_path, :checksum_sha256, :mime_type, :playback_mime_type,
              :file_size_bytes, :duration_seconds, :width, :height, :fps, :bitrate,
              :video_codec, :audio_codec, 'ready', 'active',
              :processing_phase, 100, now(), CAST(:metadata AS jsonb), now()
            )
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              original_file_name = EXCLUDED.original_file_name,
              relative_path = EXCLUDED.relative_path,
              source_relative_path = EXCLUDED.source_relative_path,
              playback_relative_path = EXCLUDED.playback_relative_path,
              checksum_sha256 = EXCLUDED.checksum_sha256,
              mime_type = EXCLUDED.mime_type,
              playback_mime_type = EXCLUDED.playback_mime_type,
              file_size_bytes = EXCLUDED.file_size_bytes,
              duration_seconds = EXCLUDED.duration_seconds,
              width = EXCLUDED.width,
              height = EXCLUDED.height,
              fps = EXCLUDED.fps,
              bitrate = EXCLUDED.bitrate,
              video_codec = EXCLUDED.video_codec,
              audio_codec = EXCLUDED.audio_codec,
              upload_status = 'ready',
              lifecycle_status = 'active',
              error_reason = NULL,
              processing_phase = EXCLUDED.processing_phase,
              processing_progress = 100,
              processed_at = COALESCE(media_assets.processed_at, now()),
              metadata = COALESCE(media_assets.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              updated_at = now()
            """
        ),
        {
            "id": asset["id"],
            "title": asset["title"],
            "original_file_name": asset["original_file_name"],
            "relative_path": asset["relative_path"],
            "source_relative_path": asset.get("source_relative_path") or asset["relative_path"],
            "playback_relative_path": asset.get("playback_relative_path") or asset["relative_path"],
            "checksum_sha256": asset.get("checksum_sha256"),
            "mime_type": asset.get("mime_type") or "video/mp4",
            "playback_mime_type": asset.get("playback_mime_type") or asset.get("mime_type") or "video/mp4",
            "file_size_bytes": asset.get("file_size_bytes"),
            "duration_seconds": asset.get("duration_seconds"),
            "width": asset.get("width"),
            "height": asset.get("height"),
            "fps": asset.get("fps"),
            "bitrate": asset.get("bitrate"),
            "video_codec": asset.get("video_codec"),
            "audio_codec": asset.get("audio_codec"),
            "processing_phase": asset.get("processing_phase") or "seeded_ready",
            "metadata": _json_param(metadata),
        },
    )
    session.execute(
        text(
            """
            INSERT INTO media_renditions (
              media_asset_id, kind, relative_path, mime_type, file_size_bytes,
              duration_seconds, width, height, fps, bitrate, video_codec, audio_codec,
              status, metadata, updated_at
            )
            VALUES (
              CAST(:id AS uuid), 'learning', :relative_path, :mime_type, :file_size_bytes,
              :duration_seconds, :width, :height, :fps, :bitrate, :video_codec, :audio_codec,
              'ready', CAST(:metadata AS jsonb), now()
            )
            ON CONFLICT (media_asset_id, kind) DO UPDATE SET
              relative_path = EXCLUDED.relative_path,
              mime_type = EXCLUDED.mime_type,
              file_size_bytes = EXCLUDED.file_size_bytes,
              duration_seconds = EXCLUDED.duration_seconds,
              width = EXCLUDED.width,
              height = EXCLUDED.height,
              fps = EXCLUDED.fps,
              bitrate = EXCLUDED.bitrate,
              video_codec = EXCLUDED.video_codec,
              audio_codec = EXCLUDED.audio_codec,
              status = 'ready',
              metadata = COALESCE(media_renditions.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              updated_at = now()
            """
        ),
        {
            "id": asset["id"],
            "relative_path": asset.get("playback_relative_path") or asset["relative_path"],
            "mime_type": asset.get("playback_mime_type") or asset.get("mime_type") or "video/mp4",
            "file_size_bytes": asset.get("file_size_bytes"),
            "duration_seconds": asset.get("duration_seconds"),
            "width": asset.get("width"),
            "height": asset.get("height"),
            "fps": asset.get("fps"),
            "bitrate": asset.get("bitrate"),
            "video_codec": asset.get("video_codec"),
            "audio_codec": asset.get("audio_codec"),
            "metadata": _json_param(metadata),
        },
    )


def _active_binding_conflicts(session: Any, binding: dict[str, Any]) -> list[dict[str, Any]]:
    canonical_point_id = str(binding.get("canonical_point_id") or "").strip() or None
    rows = session.execute(
        text(
            """
            SELECT id, node_id, canonical_point_id, media_asset_id, metadata
            FROM experiment_catalog_point_media_bindings
            WHERE binding_status <> 'archived'
              AND id <> CAST(:binding_id AS uuid)
              AND (
                (CAST(:canonical_point_id AS text) IS NOT NULL AND canonical_point_id = CAST(:canonical_point_id AS text))
                OR (CAST(:canonical_point_id AS text) IS NULL AND node_id = :node_id)
              )
            """
        ),
        {
            "binding_id": binding["id"],
            "canonical_point_id": canonical_point_id,
            "node_id": binding["node_id"],
        },
    ).mappings().all()
    return [dict(row) for row in rows]


def _is_seed_owned_binding(row: dict[str, Any]) -> bool:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    return bool(metadata.get("seed_owned") or metadata.get("seed_binding") or metadata.get("seed_version"))


def _archive_seed_conflicts(
    session: Any,
    binding: dict[str, Any],
    *,
    replace_existing_bindings: bool,
) -> None:
    conflicts = _active_binding_conflicts(session, binding)
    if not conflicts:
        return
    non_seed_conflicts = [row for row in conflicts if not _is_seed_owned_binding(row)]
    if non_seed_conflicts and not replace_existing_bindings:
        ids = ", ".join(str(row["id"]) for row in non_seed_conflicts[:5])
        raise ValueError(
            f"Non-seed active point-video binding would be replaced for {binding['node_id']}: {ids}. "
            "Pass --replace-existing-bindings to override."
        )
    session.execute(
        text(
            """
            UPDATE experiment_catalog_point_media_bindings
            SET binding_status = 'archived',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                  'archived_by_seed_import', true,
                  'replacement_seed_binding_id', CAST(:binding_id AS text),
                  'archived_at_seed_import', CAST(:archived_at AS text)
                ),
                updated_at = now()
            WHERE id IN :conflict_ids
            """
        ).bindparams(bindparam("conflict_ids", expanding=True)),
        {
            "binding_id": binding["id"],
            "archived_at": _iso_now(),
            "conflict_ids": [UUID(str(row["id"])) for row in conflicts],
        },
    )


def _upsert_binding(
    session: Any,
    payload: dict[str, Any],
    binding: dict[str, Any],
    *,
    replace_existing_bindings: bool,
) -> None:
    _archive_seed_conflicts(session, binding, replace_existing_bindings=replace_existing_bindings)
    metadata = _seed_metadata(payload, binding.get("metadata") if isinstance(binding.get("metadata"), dict) else {})
    session.execute(
        text(
            """
            INSERT INTO experiment_catalog_point_media_bindings (
              id, node_id, canonical_point_id, source_placement_node_id,
              media_asset_id, title, binding_status, display_order,
              metadata, published_at, updated_at
            )
            VALUES (
              CAST(:id AS uuid), :node_id, :canonical_point_id, :source_placement_node_id,
              CAST(:media_asset_id AS uuid), :title, 'published', :display_order,
              CAST(:metadata AS jsonb), now(), now()
            )
            ON CONFLICT (node_id, media_asset_id) DO UPDATE SET
              canonical_point_id = EXCLUDED.canonical_point_id,
              source_placement_node_id = EXCLUDED.source_placement_node_id,
              title = EXCLUDED.title,
              binding_status = 'published',
              display_order = EXCLUDED.display_order,
              metadata = COALESCE(experiment_catalog_point_media_bindings.metadata, '{}'::jsonb) || EXCLUDED.metadata,
              published_at = COALESCE(experiment_catalog_point_media_bindings.published_at, now()),
              updated_at = now()
            """
        ),
        {
            "id": binding["id"],
            "node_id": binding["node_id"],
            "canonical_point_id": str(binding.get("canonical_point_id") or "").strip() or None,
            "source_placement_node_id": binding.get("source_placement_node_id") or binding["node_id"],
            "media_asset_id": binding["media_asset_id"],
            "title": binding.get("title"),
            "display_order": int(binding.get("display_order") or 1),
            "metadata": _json_param(metadata),
        },
    )


def import_seed(
    payload: dict[str, Any],
    *,
    media_root: Path | None = None,
    dry_run: bool = False,
    replace_existing_bindings: bool = False,
) -> dict[str, Any]:
    validation = validate_manifest_payload(payload)
    if not validation["ok"]:
        raise ValueError("Media seed payload validation failed:\n" + "\n".join(validation["errors"][:80]))
    root = (media_root or get_settings().media_root).resolve()
    restore_report = _restore_files(payload, root, dry_run=dry_run)
    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "media_root": str(root),
            "manifest": validation["summary"],
            "restore": {
                "files": len(restore_report["files"]),
                "planned_relative_paths": [item["relative_path"] for item in restore_report["files"]],
            },
        }
    with db_session() as session:
        references = validate_manifest_references(session, payload)
        if not references["ok"]:
            raise ValueError("Media seed reference validation failed:\n" + "\n".join(references["errors"][:80]))
        for asset in payload.get("assets") or []:
            if isinstance(asset, dict):
                _upsert_media_asset(session, payload, asset)
        for binding in payload.get("bindings") or []:
            if isinstance(binding, dict):
                _upsert_binding(session, payload, binding, replace_existing_bindings=replace_existing_bindings)
    return {
        "ok": True,
        "dry_run": False,
        "media_root": str(root),
        "assets": validation["summary"]["assets"],
        "bindings": validation["summary"]["bindings"],
        "restored_files": restore_report["restored"],
        "verified_files": restore_report["verified"],
    }


def validate_database(payload: dict[str, Any], *, media_root: Path | None = None) -> dict[str, Any]:
    root = (media_root or get_settings().media_root).resolve()
    expected = payload.get("expected_counts") or {}
    seed_version = str(payload.get("seed_version") or "")
    file_errors: list[str] = []
    for asset in payload.get("assets") or []:
        if not isinstance(asset, dict):
            continue
        destination = _safe_media_destination(root, str(asset.get("target_relative_path") or asset.get("relative_path") or ""))
        if not destination.exists():
            file_errors.append(f"{asset.get('id')}: missing file {destination}")
            continue
        if destination.stat().st_size != int(asset.get("file_size_bytes") or -1):
            file_errors.append(f"{asset.get('id')}: size mismatch {destination}")
        expected_sha = str(asset.get("checksum_sha256") or "")
        if expected_sha and checksum_sha256_file(destination) != expected_sha:
            file_errors.append(f"{asset.get('id')}: checksum mismatch {destination}")
    with db_session() as session:
        row = session.execute(
            text(
                """
                WITH seed_assets AS (
                  SELECT *
                  FROM media_assets
                  WHERE metadata->>'seed_version' = :seed_version
                    AND COALESCE(lifecycle_status, 'active') = 'active'
                ),
                active_seed_bindings AS (
                  SELECT mb.*
                  FROM experiment_catalog_point_media_bindings mb
                  WHERE mb.metadata->>'seed_version' = :seed_version
                    AND mb.binding_status <> 'archived'
                ),
                covered_points AS (
                  SELECT n.id, b.metadata->>'coverage_kind' AS coverage_kind
                  FROM experiment_catalog_nodes n
                  JOIN active_seed_bindings b
                    ON (
                      (n.canonical_point_id IS NOT NULL AND b.canonical_point_id = n.canonical_point_id)
                      OR (n.canonical_point_id IS NULL AND b.node_id = n.id)
                    )
                  JOIN media_assets ma ON ma.id = b.media_asset_id
                  WHERE n.node_kind = 'point'
                    AND n.status <> 'archived'
                    AND ma.upload_status = 'ready'
                    AND COALESCE(ma.lifecycle_status, 'active') = 'active'
                )
                SELECT
                  (SELECT count(*) FROM seed_assets) AS media_assets,
                  (SELECT count(*) FROM seed_assets WHERE upload_status = 'ready') AS ready_media_assets,
                  (SELECT count(*) FROM seed_assets WHERE metadata->>'seed_kind' = 'real_video') AS real_video_assets,
                  (SELECT count(*) FROM seed_assets WHERE metadata->>'seed_kind' = 'placeholder_video') AS placeholder_video_assets,
                  (SELECT count(*) FROM media_renditions r JOIN seed_assets a ON a.id = r.media_asset_id WHERE r.kind = 'learning' AND r.status = 'ready') AS ready_learning_renditions,
                  (SELECT count(*) FROM active_seed_bindings) AS active_point_media_bindings,
                  (SELECT count(*) FROM covered_points) AS covered_point_nodes,
                  (SELECT count(*) FROM covered_points WHERE coverage_kind = 'real_video') AS real_video_covered_point_nodes,
                  (SELECT count(*) FROM covered_points WHERE coverage_kind = 'placeholder_video') AS placeholder_video_covered_point_nodes
                """
            ),
            {"seed_version": seed_version},
        ).mappings().one()
    errors = list(file_errors)
    checks = {
        "media_assets": expected.get("media_assets"),
        "ready_media_assets": expected.get("media_assets"),
        "real_video_assets": expected.get("real_video_assets"),
        "placeholder_video_assets": expected.get("placeholder_video_assets"),
        "ready_learning_renditions": expected.get("media_assets"),
        "active_point_media_bindings": expected.get("active_point_media_bindings"),
        "covered_point_nodes": expected.get("active_catalog_point_nodes"),
        "real_video_covered_point_nodes": expected.get("real_video_covered_point_nodes"),
        "placeholder_video_covered_point_nodes": expected.get("placeholder_video_covered_point_nodes"),
    }
    for key, expected_value in checks.items():
        if expected_value is None:
            continue
        actual = int(row[key] or 0)
        if actual != int(expected_value):
            errors.append(f"{key}: expected {expected_value}, got {actual}")
    return {
        "ok": not errors,
        "errors": errors,
        "summary": {key: int(row[key] or 0) for key in row.keys()},
        "media_root": str(root),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore seed experiment videos and bind them to catalog points.")
    parser.add_argument("command", choices=["import", "validate", "payload"], nargs="?", default="import")
    parser.add_argument("--manifest-path", type=Path, default=DEFAULT_MANIFEST_PATH)
    parser.add_argument("--media-root", type=Path)
    parser.add_argument("--skip-migrations", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--replace-existing-bindings",
        action="store_true",
        help="Archive non-seed active point-video bindings that conflict with the seed.",
    )
    args = parser.parse_args()

    payload = load_manifest(args.manifest_path)
    if args.command == "payload":
        result = validate_manifest_payload(payload)
    else:
        if not args.skip_migrations:
            apply_migrations()
        if args.command == "validate":
            result = validate_database(payload, media_root=args.media_root)
        else:
            result = import_seed(
                payload,
                media_root=args.media_root,
                dry_run=args.dry_run,
                replace_existing_bindings=args.replace_existing_bindings,
            )
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    if isinstance(result, dict) and result.get("ok") is False:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
