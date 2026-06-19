from __future__ import annotations

from types import SimpleNamespace

from server.app.domains.media import assets as media_assets
from server.app.domains.media import files as media_files
from server.app.domains.media import lifecycle as media_lifecycle


def test_media_asset_file_summary_reports_available_primary_file(monkeypatch, tmp_path):
    source = tmp_path / "originals" / "asset-1" / "source.mp4"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"video")
    monkeypatch.setattr(media_assets, "get_settings", lambda: SimpleNamespace(media_root=tmp_path))
    monkeypatch.setattr(media_files, "get_settings", lambda: SimpleNamespace(media_root=tmp_path))

    summary = media_assets.media_asset_file_summary(
        {
            "relative_path": "originals/asset-1/source.mp4",
            "source_relative_path": "originals/asset-1/source.mp4",
            "playback_relative_path": None,
            "thumbnail_relative_path": None,
            "upload_status": "ready",
            "renditions": [],
        }
    )

    assert summary["file_state"] == "available"
    assert summary["primary_file_available"] is True
    assert summary["existing_file_count"] == 1
    assert summary["missing_file_count"] == 0


def test_media_asset_file_summary_reports_missing_ready_asset(monkeypatch, tmp_path):
    monkeypatch.setattr(media_assets, "get_settings", lambda: SimpleNamespace(media_root=tmp_path))
    monkeypatch.setattr(media_files, "get_settings", lambda: SimpleNamespace(media_root=tmp_path))

    summary = media_assets.media_asset_file_summary(
        {
            "relative_path": "originals/asset-2/source.mp4",
            "source_relative_path": "originals/asset-2/source.mp4",
            "playback_relative_path": "renditions/asset-2/learning.mp4",
            "thumbnail_relative_path": "thumbnails/asset-2.jpg",
            "upload_status": "ready",
            "renditions": [{"kind": "learning", "relative_path": "renditions/asset-2/learning.mp4"}],
        }
    )

    assert summary["file_state"] == "missing"
    assert summary["primary_file_available"] is False
    assert summary["existing_file_count"] == 0
    assert summary["missing_file_count"] == 3


def test_orphan_media_files_excludes_referenced_paths(monkeypatch, tmp_path):
    kept = tmp_path / "uploads" / "kept.mp4"
    orphan = tmp_path / "uploads" / "orphan.mp4"
    kept.parent.mkdir(parents=True)
    kept.write_bytes(b"kept")
    orphan.write_bytes(b"orphan")
    monkeypatch.setattr(media_lifecycle, "get_settings", lambda: SimpleNamespace(media_root=tmp_path))

    files, total_count, total_bytes = media_lifecycle.orphan_media_files({"uploads/kept.mp4"}, limit=10)

    assert total_count == 1
    assert total_bytes == len(b"orphan")
    assert files == [{"relative_path": "uploads/orphan.mp4", "file_size_bytes": len(b"orphan")}]
