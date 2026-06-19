from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.infrastructure.database import apply_migrations, db_session

DEFAULT_CHUNK_FILE = ROOT / "data" / "seed" / "canonical_rag" / "chunks" / "textbook_experiment_chunks_v1.jsonl"
DEFAULT_REPORT = ROOT / "artifacts" / "experiment_knowledge_framework_import_report.json"
SOURCE_COLLECTION = "textbook_experiment_clean_v1"
DOC_ID = "DOC_CANONICAL_EXPERIMENT_V1"
BOOK_TITLE = "无机化学实验（第四版）"
EXPECTED_CHUNK_COUNT = 349


def _json(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False)


def _jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                rows.append(json.loads(stripped))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number}: invalid JSONL row") from exc
    return rows


def _stable_id(prefix: str, value: str) -> str:
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:20].upper()
    return f"{prefix}_{digest}"


def _node_key(path_items: list[str]) -> str:
    return f"{SOURCE_COLLECTION}|{DOC_ID}|" + " / ".join(path_items)


def _normalize_title(value: Any) -> str:
    text_value = str(value or "").strip()
    text_value = re.sub(r"\s+", "", text_value)
    text_value = text_value.replace("·", "").replace("：", ":")
    return text_value


def _node_type(path_items: list[str]) -> str:
    if not path_items:
        return "book"
    title = path_items[-1]
    if len(path_items) == 1:
        return "chapter"
    if re.match(r"^实验\s*\d", title):
        return "protocol"
    return "section"


def _path_items(chunk: dict[str, Any]) -> list[str]:
    items = [str(item).strip() for item in chunk.get("section_path") or [] if str(item).strip()]
    if items and items[0] == "第7章" and any(re.match(r"^实验\s*(?:19|20)\b", item) for item in items[1:]):
        items[0] = "第7章 元素性质实验"
    if items:
        return items
    chapter = str(chunk.get("chapter") or "").strip()
    knowledge_unit = str(chunk.get("knowledge_unit") or "").strip()
    return [item for item in [chapter, knowledge_unit] if item]


def _page_start(chunk: dict[str, Any]) -> int | None:
    value = chunk.get("page_start")
    return int(value) if value is not None else None


def _page_end(chunk: dict[str, Any]) -> int | None:
    value = chunk.get("page_end")
    return int(value) if value is not None else _page_start(chunk)


def _merge_pages(node: dict[str, Any], chunk: dict[str, Any]) -> None:
    start = _page_start(chunk)
    end = _page_end(chunk)
    if start is not None:
        node["page_start"] = start if node["page_start"] is None else min(node["page_start"], start)
    if end is not None:
        node["page_end"] = end if node["page_end"] is None else max(node["page_end"], end)


def load_experiment_chunks(path: Path) -> list[dict[str, Any]]:
    chunks = _jsonl(path)
    seen: set[str] = set()
    errors: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        chunk_id = str(chunk.get("chunk_id") or "").strip()
        if not chunk_id:
            errors.append(f"row {index}: missing chunk_id")
        elif chunk_id in seen:
            errors.append(f"duplicate chunk_id: {chunk_id}")
        seen.add(chunk_id)
        if chunk.get("source_collection") != SOURCE_COLLECTION:
            errors.append(f"{chunk_id or index}: unexpected source_collection {chunk.get('source_collection')}")
        if not _path_items(chunk):
            errors.append(f"{chunk_id or index}: missing section_path")
    if len(chunks) != EXPECTED_CHUNK_COUNT:
        errors.append(f"expected {EXPECTED_CHUNK_COUNT} chunks, got {len(chunks)}")
    if errors:
        raise ValueError("Experiment chunk validation failed:\n" + "\n".join(errors[:80]))
    return chunks


def build_nodes_and_links(chunks: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    root_key = _node_key([])
    root_id = _stable_id("EXPFW", root_key)
    nodes_by_key: dict[str, dict[str, Any]] = {
        root_key: {
            "id": root_id,
            "parent_id": None,
            "source_collection": SOURCE_COLLECTION,
            "doc_id": DOC_ID,
            "book_title": BOOK_TITLE,
            "node_key": root_key,
            "node_type": "book",
            "title": BOOK_TITLE,
            "full_path": [],
            "depth": 0,
            "display_order": 0,
            "page_start": None,
            "page_end": None,
            "metadata": {
                "source": "canonical_experiment_chunks_v1",
                "source_collection": SOURCE_COLLECTION,
            },
        }
    }
    display_order = 1
    chunk_links: list[dict[str, Any]] = []
    for chunk_index, chunk in enumerate(chunks, start=1):
        path_items = _path_items(chunk)
        parent_key = root_key
        for depth in range(1, len(path_items) + 1):
            current_path = path_items[:depth]
            key = _node_key(current_path)
            node = nodes_by_key.get(key)
            if node is None:
                node = {
                    "id": _stable_id("EXPFW", key),
                    "parent_id": nodes_by_key[parent_key]["id"],
                    "source_collection": SOURCE_COLLECTION,
                    "doc_id": DOC_ID,
                    "book_title": BOOK_TITLE,
                    "node_key": key,
                    "node_type": _node_type(current_path),
                    "title": current_path[-1],
                    "full_path": current_path,
                    "depth": depth,
                    "display_order": display_order,
                    "page_start": None,
                    "page_end": None,
                    "metadata": {
                        "source": "canonical_experiment_chunks_v1",
                        "chapter": chunk.get("chapter"),
                    },
                }
                nodes_by_key[key] = node
                display_order += 1
            _merge_pages(node, chunk)
            parent_key = key
        _merge_pages(nodes_by_key[root_key], chunk)
        deepest_key = _node_key(path_items)
        chunk_links.append(
            {
                "node_id": nodes_by_key[deepest_key]["id"],
                "chunk_id": str(chunk["chunk_id"]),
                "sort_order": chunk_index,
                "metadata": {
                    "content_type": chunk.get("content_type"),
                    "knowledge_unit": chunk.get("knowledge_unit"),
                    "section_path": path_items,
                    "page_start": chunk.get("page_start"),
                    "page_end": chunk.get("page_end"),
                },
            }
        )
    return list(nodes_by_key.values()), chunk_links


def _fetch_existing_chunk_ids(session: Any, chunk_ids: list[str]) -> set[str]:
    if not chunk_ids:
        return set()
    rows = session.execute(
        text("SELECT id FROM source_chunks WHERE id = ANY(:chunk_ids)"),
        {"chunk_ids": chunk_ids},
    ).scalars()
    return {str(row) for row in rows}


def _fetch_formal_experiments(session: Any) -> list[dict[str, Any]]:
    return [
        dict(row)
        for row in session.execute(
            text(
                """
                SELECT id, code, title, status, display_order, metadata
                FROM formal_experiments
                WHERE status <> 'archived'
                ORDER BY display_order, code
                """
            )
        )
        .mappings()
        .all()
    ]


def _experiment_parent_title(experiment: dict[str, Any]) -> str:
    metadata = experiment.get("metadata") or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            metadata = {}
    for key in ("parent_title", "source_parent_title", "experiment_group_title"):
        if metadata.get(key):
            return str(metadata[key])
    code = str(experiment.get("code") or "").strip()
    if code:
        return f"实验 {code.rsplit('-', 1)[0]}"
    return ""


def _fetch_canonical_experiment_links(session: Any) -> list[dict[str, Any]]:
    return [
        dict(row)
        for row in session.execute(
            text(
                """
                SELECT id AS chunk_id, related_experiment_ids
                FROM source_chunks
                WHERE metadata->>'source_collection' = :source_collection
                  AND cardinality(COALESCE(related_experiment_ids, '{}'::text[])) > 0
                ORDER BY id
                """
            ),
            {"source_collection": SOURCE_COLLECTION},
        )
        .mappings()
        .all()
    ]


def import_framework(*, chunks_path: Path, skip_migrations: bool, report_path: Path | None) -> dict[str, Any]:
    if not skip_migrations:
        apply_migrations()
    chunks = load_experiment_chunks(chunks_path)
    nodes, chunk_links = build_nodes_and_links(chunks)
    node_by_id = {node["id"]: node for node in nodes}
    node_by_title = {_normalize_title(node["title"]): node for node in nodes if node["node_type"] == "protocol"}
    chunk_to_node = {link["chunk_id"]: link["node_id"] for link in chunk_links}
    chunk_ids = sorted(chunk_to_node)

    with db_session() as session:
        existing_chunk_ids = _fetch_existing_chunk_ids(session, chunk_ids)
        missing_chunk_ids = sorted(set(chunk_ids) - existing_chunk_ids)
        if missing_chunk_ids:
            raise ValueError(
                "Canonical experiment chunks must be imported before framework import. Missing examples: "
                + ", ".join(missing_chunk_ids[:10])
            )

        session.execute(
            text(
                """
                DELETE FROM experiment_framework_nodes
                WHERE source_collection = :source_collection AND doc_id = :doc_id
                """
            ),
            {"source_collection": SOURCE_COLLECTION, "doc_id": DOC_ID},
        )

        for node in sorted(nodes, key=lambda item: item["display_order"]):
            session.execute(
                text(
                    """
                    INSERT INTO experiment_framework_nodes (
                      id, parent_id, source_collection, doc_id, book_title, node_key,
                      node_type, title, full_path, depth, display_order, page_start,
                      page_end, metadata, updated_at
                    )
                    VALUES (
                      :id, :parent_id, :source_collection, :doc_id, :book_title, :node_key,
                      :node_type, :title, :full_path, :depth, :display_order, :page_start,
                      :page_end, CAST(:metadata AS jsonb), now()
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      parent_id = EXCLUDED.parent_id,
                      source_collection = EXCLUDED.source_collection,
                      doc_id = EXCLUDED.doc_id,
                      book_title = EXCLUDED.book_title,
                      node_key = EXCLUDED.node_key,
                      node_type = EXCLUDED.node_type,
                      title = EXCLUDED.title,
                      full_path = EXCLUDED.full_path,
                      depth = EXCLUDED.depth,
                      display_order = EXCLUDED.display_order,
                      page_start = EXCLUDED.page_start,
                      page_end = EXCLUDED.page_end,
                      metadata = EXCLUDED.metadata,
                      updated_at = now()
                    """
                ),
                {**node, "metadata": _json(node["metadata"])},
            )

        for link in chunk_links:
            session.execute(
                text(
                    """
                    INSERT INTO experiment_framework_chunk_links (
                      node_id, chunk_id, relation_type, sort_order, metadata
                    )
                    VALUES (
                      :node_id, :chunk_id, 'primary_evidence', :sort_order, CAST(:metadata AS jsonb)
                    )
                    ON CONFLICT (node_id, chunk_id, relation_type) DO UPDATE SET
                      sort_order = EXCLUDED.sort_order,
                      metadata = EXCLUDED.metadata
                    """
                ),
                {**link, "metadata": _json(link["metadata"])},
            )

        formal_experiments = _fetch_formal_experiments(session)
        missing_parent_titles: list[dict[str, str]] = []
        parent_title_link_count = 0
        for experiment in formal_experiments:
            parent_title = _experiment_parent_title(experiment)
            parent_node = node_by_title.get(_normalize_title(parent_title))
            if not parent_node:
                missing_parent_titles.append(
                    {
                        "experiment_id": str(experiment.get("id") or ""),
                        "experiment_code": str(experiment.get("code") or ""),
                        "parent_title": parent_title,
                    }
                )
                continue
            session.execute(
                text(
                    """
                    INSERT INTO experiment_framework_formal_links (
                      node_id, experiment_id, relation_type, link_source, evidence_chunk_id,
                      confidence, sort_order, metadata
                    )
                    VALUES (
                      :node_id, :experiment_id, 'formal_parent_title', 'formal_experiment_metadata',
                      NULL, 0.92, :sort_order, CAST(:metadata AS jsonb)
                    )
                    """
                ),
                {
                    "node_id": parent_node["id"],
                    "experiment_id": experiment["id"],
                    "sort_order": int(experiment.get("display_order") or 0),
                    "metadata": _json({"parent_title": parent_title, "formal_code": experiment.get("code")}),
                },
            )
            parent_title_link_count += 1

        known_formal_ids = {str(item["id"]) for item in formal_experiments}
        canonical_link_count = 0
        canonical_linked_experiments: set[str] = set()
        for row in _fetch_canonical_experiment_links(session):
            chunk_id = str(row["chunk_id"])
            node_id = chunk_to_node.get(chunk_id)
            if not node_id:
                continue
            for experiment_id in row.get("related_experiment_ids") or []:
                experiment_id = str(experiment_id)
                if experiment_id not in known_formal_ids:
                    continue
                session.execute(
                    text(
                        """
                        INSERT INTO experiment_framework_formal_links (
                          node_id, experiment_id, relation_type, link_source, evidence_chunk_id,
                          confidence, sort_order, metadata
                        )
                        VALUES (
                          :node_id, :experiment_id, 'canonical_evidence', 'source_chunks.related_experiment_ids',
                          :chunk_id, 1, :sort_order, CAST(:metadata AS jsonb)
                        )
                        """
                    ),
                    {
                        "node_id": node_id,
                        "experiment_id": experiment_id,
                        "chunk_id": chunk_id,
                        "sort_order": int(node_by_id[node_id]["display_order"]),
                        "metadata": _json({"chunk_id": chunk_id}),
                    },
                )
                canonical_link_count += 1
                canonical_linked_experiments.add(experiment_id)

    direct_counts: dict[str, int] = defaultdict(int)
    for link in chunk_links:
        direct_counts[str(link["node_id"])] += 1
    chapter_2_bad_paths = [
        chunk["chunk_id"]
        for chunk in chunks
        if any(re.match(r"^2\.(?:[5-9]|1[0-2])\b", str(item)) for item in _path_items(chunk))
        and any("2.4" in str(item) for item in _path_items(chunk)[:-1])
    ]
    report = {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_collection": SOURCE_COLLECTION,
        "doc_id": DOC_ID,
        "book_title": BOOK_TITLE,
        "chunk_file": str(chunks_path),
        "node_count": len(nodes),
        "chapter_count": sum(1 for node in nodes if node["node_type"] == "chapter"),
        "protocol_count": sum(1 for node in nodes if node["node_type"] == "protocol"),
        "chunk_count": len(chunks),
        "linked_chunk_count": len(chunk_links),
        "chunk_link_node_count": len(direct_counts),
        "formal_experiment_count": len(known_formal_ids),
        "formal_parent_title_link_count": parent_title_link_count,
        "canonical_evidence_link_count": canonical_link_count,
        "canonical_evidence_experiment_count": len(canonical_linked_experiments),
        "missing_parent_title_count": len(missing_parent_titles),
        "missing_parent_titles": missing_parent_titles,
        "chapter_2_bad_path_count": len(chapter_2_bad_paths),
        "chapter_2_bad_paths": chapter_2_bad_paths[:20],
        "namespace_isolated": True,
    }
    if report["linked_chunk_count"] != EXPECTED_CHUNK_COUNT:
        raise ValueError(f"Expected {EXPECTED_CHUNK_COUNT} linked chunks, got {report['linked_chunk_count']}")
    if report["chapter_2_bad_path_count"]:
        raise ValueError("Experiment Chapter 2 hierarchy still has stale 2.4 parent paths")
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Build experiment textbook knowledge framework from canonical chunks.")
    parser.add_argument("--chunks", type=Path, default=DEFAULT_CHUNK_FILE)
    parser.add_argument("--skip-migrations", action="store_true")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    result = import_framework(chunks_path=args.chunks, skip_migrations=args.skip_migrations, report_path=args.report)
    sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
