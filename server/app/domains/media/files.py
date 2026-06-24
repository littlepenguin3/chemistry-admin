from __future__ import annotations

import hashlib
import json
import mimetypes
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from server.app.infrastructure.settings import get_settings


ALLOWED_MEDIA_SUFFIXES = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}
ALLOWED_MEDIA_MIME_PREFIXES = ("video/",)
PROCESSING_JOB_TYPE = "process_uploaded_video"


@dataclass(frozen=True)
class MediaValidation:
    ok: bool
    mime_type: str
    file_size_bytes: int
    error: str | None = None


def validate_media_file(filename: str, content: bytes, content_type: str | None = None) -> MediaValidation:
    suffix = Path(filename).suffix.lower()
    guessed_type = content_type or mimetypes.guess_type(filename)[0] or ""
    if suffix not in ALLOWED_MEDIA_SUFFIXES:
        return MediaValidation(False, guessed_type, len(content), "unsupported_file_extension")
    if guessed_type and not guessed_type.startswith(ALLOWED_MEDIA_MIME_PREFIXES):
        return MediaValidation(False, guessed_type, len(content), "unsupported_mime_type")
    max_bytes = get_settings().max_media_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        return MediaValidation(False, guessed_type, len(content), "file_too_large")
    if not content:
        return MediaValidation(False, guessed_type, len(content), "empty_file")
    return MediaValidation(True, guessed_type or "application/octet-stream", len(content))


def media_upload_policy() -> dict[str, Any]:
    settings = get_settings()
    max_media_upload_mb = int(settings.max_media_upload_mb)
    return {
        "max_media_upload_mb": max_media_upload_mb,
        "max_media_upload_bytes": max_media_upload_mb * 1024 * 1024,
        "allowed_extensions": sorted(ALLOWED_MEDIA_SUFFIXES),
    }


def checksum_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def checksum_sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_param(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False, default=str)


def safe_media_path(filename: str) -> tuple[Path, str]:
    settings = get_settings()
    suffix = Path(filename).suffix.lower()
    relative_path = Path("uploads") / f"{secrets.token_hex(16)}{suffix}"
    absolute_path = settings.media_root / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    return absolute_path, relative_path.as_posix()


def source_media_path(asset_id: str, filename: str) -> tuple[Path, str]:
    settings = get_settings()
    suffix = Path(filename).suffix.lower() or ".mp4"
    relative_path = Path("originals") / asset_id / f"source{suffix}"
    absolute_path = settings.media_root / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    return absolute_path, relative_path.as_posix()


def resolve_media_relative(relative_path: str) -> Path:
    root = get_settings().media_root.resolve()
    path = (root / relative_path).resolve()
    if root != path and root not in path.parents:
        raise ValueError("Media path escapes media root")
    return path
