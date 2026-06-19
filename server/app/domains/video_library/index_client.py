from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from typing import Any

from sqlalchemy import text

from server.app.infrastructure.settings import get_settings
from server.app.infrastructure.database import db_session


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")


def document_hash(document: dict[str, Any]) -> str:
    return hashlib.sha256(_json_bytes(document)).hexdigest()


def video_library_index_mapping(*, analyzer: str = "ik_max_word", search_analyzer: str = "ik_smart") -> dict[str, Any]:
    return {
        "settings": {
            "analysis": {
                "analyzer": {
                    "chemistry_ik": {
                        "type": "custom",
                        "tokenizer": analyzer,
                        "filter": ["lowercase"],
                    }
                },
                "normalizer": {
                    "chemistry_keyword": {
                        "type": "custom",
                        "filter": ["lowercase"],
                    }
                },
            }
        },
        "mappings": {
            "dynamic": "false",
            "properties": {
                "id": {"type": "keyword"},
                "result_type": {"type": "keyword"},
                "experiment_id": {"type": "keyword"},
                "point_key": {"type": "keyword"},
                "chapter_ids": {"type": "keyword"},
                "title": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "subtitle": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "snippet": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "search_text": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "principle": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "phenomenon_explanation": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "safety_note": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "formulae": {"type": "keyword", "normalizer": "chemistry_keyword"},
                "aliases": {"type": "text", "analyzer": "chemistry_ik", "search_analyzer": search_analyzer},
                "reaction_features": {"type": "keyword"},
                "has_video": {"type": "boolean"},
                "video_count": {"type": "integer"},
                "target": {"type": "object", "enabled": True},
                "badges": {"type": "keyword"},
                "updated_at": {"type": "date"},
            },
        },
    }


class VideoLibraryIndexClient:
    def __init__(self, *, base_url: str, index: str, timeout: float = 3.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.index = index
        self.timeout = timeout

    def request(self, method: str, path: str, payload: Any | None = None) -> Any:
        data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method=method,
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            body = response.read().decode("utf-8")
        return json.loads(body) if body else {}

    def health(self) -> dict[str, Any]:
        return self.request("GET", "/_cluster/health")

    def ensure_index(self, *, recreate: bool = False, analyzer: str = "ik_max_word") -> None:
        if recreate:
            try:
                self.request("DELETE", f"/{self.index}")
            except urllib.error.HTTPError as exc:
                if exc.code != 404:
                    raise
        try:
            self.request("HEAD", f"/{self.index}")
            return
        except urllib.error.HTTPError as exc:
            if exc.code != 404:
                raise
        self.request("PUT", f"/{self.index}", video_library_index_mapping(analyzer=analyzer))

    def upsert_document(self, document: dict[str, Any]) -> None:
        self.request("PUT", f"/{self.index}/_doc/{document['id']}", document)

    def delete_document(self, document_id: str) -> None:
        try:
            self.request("DELETE", f"/{self.index}/_doc/{document_id}")
        except urllib.error.HTTPError as exc:
            if exc.code != 404:
                raise


def configured_index_client() -> VideoLibraryIndexClient | None:
    settings = get_settings()
    if settings.video_library_search_backend != "elasticsearch" or not settings.video_library_search_url:
        return None
    return VideoLibraryIndexClient(
        base_url=settings.video_library_search_url,
        index=settings.video_library_search_index,
        timeout=settings.video_library_search_timeout_seconds,
    )


def video_library_index_diagnostics() -> dict[str, Any]:
    settings = get_settings()
    with db_session() as session:
        status_rows = session.execute(
            text(
                """
                SELECT sync_status, COUNT(*) AS count
                FROM experiment_video_point_search_index_state
                GROUP BY sync_status
                """
            )
        ).mappings().all()
        published_point_count = int(
            session.execute(
                text("SELECT COUNT(*) FROM experiment_point_learning_content WHERE content_status = 'published'")
            ).scalar_one()
            or 0
        )
        failed_rows = [
            dict(row)
            for row in session.execute(
                text(
                    """
                    SELECT experiment_id, point_key, document_id, desired_action, sync_status,
                           attempts, last_error, updated_at
                    FROM experiment_video_point_search_index_state
                    WHERE sync_status IN ('failed', 'pending')
                    ORDER BY updated_at DESC
                    LIMIT 20
                    """
                )
            ).mappings().all()
        ]
    client = configured_index_client()
    es: dict[str, Any] = {"configured": client is not None}
    if client is not None:
        try:
            es["health"] = client.health()
            count_payload = client.request("GET", f"/{client.index}/_count")
            es["document_count"] = count_payload.get("count")
        except Exception as exc:  # noqa: BLE001 - diagnostics should be best-effort.
            es["error"] = str(exc)
    return {
        "settings": {
            "enabled": settings.video_library_search_enabled,
            "backend": settings.video_library_search_backend,
            "index": settings.video_library_search_index,
            "analyzer": settings.video_library_search_analyzer,
            "local_fallback": settings.video_library_search_local_fallback,
        },
        "postgres": {
            "published_point_content_count": published_point_count,
            "sync_status_counts": {str(row["sync_status"]): int(row["count"]) for row in status_rows},
            "retryable_rows": failed_rows,
        },
        "elasticsearch": es,
    }


def mark_index_sync_success(*, experiment_id: str, point_key: str, document_id: str, payload_hash: str) -> None:
    with db_session() as session:
        session.execute(
            text(
                """
                INSERT INTO experiment_video_point_search_index_state (
                  experiment_id, point_key, document_id, desired_action, sync_status,
                  attempts, document_hash, last_error, indexed_at, last_attempted_at, updated_at
                )
                VALUES (
                  :experiment_id, :point_key, :document_id, 'upsert', 'synced',
                  1, :document_hash, NULL, now(), now(), now()
                )
                ON CONFLICT (experiment_id, point_key) DO UPDATE SET
                  document_id = EXCLUDED.document_id,
                  sync_status = 'synced',
                  attempts = experiment_video_point_search_index_state.attempts + 1,
                  document_hash = EXCLUDED.document_hash,
                  last_error = NULL,
                  indexed_at = now(),
                  last_attempted_at = now(),
                  updated_at = now()
                """
            ),
            {
                "experiment_id": experiment_id,
                "point_key": point_key,
                "document_id": document_id,
                "document_hash": payload_hash,
            },
        )


def mark_index_sync_failure(*, experiment_id: str, point_key: str, document_id: str, action: str, error: str) -> None:
    with db_session() as session:
        session.execute(
            text(
                """
                INSERT INTO experiment_video_point_search_index_state (
                  experiment_id, point_key, document_id, desired_action, sync_status,
                  attempts, last_error, last_attempted_at, updated_at
                )
                VALUES (
                  :experiment_id, :point_key, :document_id, :action, 'failed',
                  1, :error, now(), now()
                )
                ON CONFLICT (experiment_id, point_key) DO UPDATE SET
                  document_id = EXCLUDED.document_id,
                  desired_action = EXCLUDED.desired_action,
                  sync_status = 'failed',
                  attempts = experiment_video_point_search_index_state.attempts + 1,
                  last_error = EXCLUDED.last_error,
                  last_attempted_at = now(),
                  updated_at = now()
                """
            ),
            {
                "experiment_id": experiment_id,
                "point_key": point_key,
                "document_id": document_id,
                "action": action,
                "error": error[:1000],
            },
        )
