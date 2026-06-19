from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.infrastructure.database import apply_migrations, db_session

SEED_RAG_DIR = ROOT / "data" / "seed" / "canonical_rag"
DEFAULT_CHUNK_FILES = [
    SEED_RAG_DIR / "chunks" / "textbook_inorganic_lower_chunks_v1.jsonl",
    SEED_RAG_DIR / "chunks" / "textbook_experiment_chunks_v1.jsonl",
]
DEFAULT_EMBEDDING_DIR = SEED_RAG_DIR / "embeddings" / "canonical_base_v1"
EMBEDDING_MODEL = "BAAI/bge-m3"
EMBEDDING_DIMENSION = 1024

SOURCE_DOCUMENTS = {
    "textbook_inorganic_lower_v1": {
        "id": "DOC_CANONICAL_INORGANIC_LOWER_V1",
        "file_name": "无机化学（下册）（第二版）",
        "path": str(SEED_RAG_DIR / "chunks" / "textbook_inorganic_lower_chunks_v1.jsonl"),
        "type": "jsonl",
        "document_kind": "canonical_textbook",
    },
    "textbook_experiment_clean_v1": {
        "id": "DOC_CANONICAL_EXPERIMENT_V1",
        "file_name": "无机化学实验（第四版）",
        "path": str(SEED_RAG_DIR / "chunks" / "textbook_experiment_chunks_v1.jsonl"),
        "type": "jsonl",
        "document_kind": "canonical_textbook",
    },
}


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


def _chapter_id(chunk: dict[str, Any]) -> str | None:
    source_collection = str(chunk.get("source_collection") or "")
    if source_collection != "textbook_inorganic_lower_v1":
        return None
    candidates = [chunk.get("chapter"), *(chunk.get("section_path") or [])]
    for value in candidates:
        match = re.search(r"第\s*(\d{1,2})\s*章", str(value or ""))
        if match:
            return f"CH{int(match.group(1)):02d}"
    return None


def _section_title(chunk: dict[str, Any]) -> str:
    section_path = [str(item).strip() for item in chunk.get("section_path") or [] if str(item).strip()]
    return " / ".join(section_path[-3:]) if section_path else str(chunk.get("knowledge_unit") or "")


def _metadata(chunk: dict[str, Any], source_path: Path) -> dict[str, Any]:
    keys = [
        "parent_id",
        "doc_id",
        "source_collection",
        "source_role",
        "authority_level",
        "book_title",
        "page_start",
        "page_end",
        "section_path",
        "chapter",
        "content_type",
        "knowledge_unit",
        "source_md_files",
        "source_page_images",
        "asset_paths",
        "formulas",
        "reactions",
        "compounds",
        "elements",
        "units",
        "table_title",
        "table_columns",
        "row_values",
        "prev_chunk_id",
        "next_chunk_id",
        "content_hash",
        "quality_flags",
        "relations",
        "has_reaction",
        "has_table",
        "has_figure",
        "use_for_routing",
        "use_for_question_generation",
    ]
    return {
        "import_version": "canonical_base_v1",
        "import_source_file": str(source_path),
        **{key: chunk.get(key) for key in keys if key in chunk},
    }


def load_chunks(paths: list[Path]) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    seen: set[str] = set()
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(path)
        for chunk in _jsonl(path):
            chunk_id = str(chunk.get("chunk_id") or "").strip()
            if not chunk_id:
                raise ValueError(f"{path}: chunk missing chunk_id")
            if chunk_id in seen:
                raise ValueError(f"Duplicate canonical chunk_id: {chunk_id}")
            seen.add(chunk_id)
            chunk["_source_path"] = str(path)
            chunks.append(chunk)
    return chunks


def cleanup_legacy_rows(session: Any) -> dict[str, int]:
    session.execute(text("DROP INDEX IF EXISTS idx_chunk_embeddings_cosine"))
    statements = [
        (
            "review_items",
            """
            DELETE FROM review_items
            WHERE target_type IN ('source_chunk', 'question', 'resource', 'link')
            """,
        ),
        ("links", "DELETE FROM links"),
        ("chunk_embeddings", "DELETE FROM chunk_embeddings"),
        ("questions", "DELETE FROM questions"),
        ("resources", "DELETE FROM resources"),
        ("source_chunks", "DELETE FROM source_chunks"),
        ("source_documents", "DELETE FROM source_documents"),
    ]
    report: dict[str, int] = {}
    for label, statement in statements:
        result = session.execute(text(statement))
        report[label] = max(int(result.rowcount or 0), 0)
    return report


def ensure_embedding_index(session: Any) -> None:
    session.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_cosine
              ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)
            """
        )
    )


def insert_source_documents(session: Any) -> int:
    count = 0
    for source_collection, doc in SOURCE_DOCUMENTS.items():
        session.execute(
            text(
                """
                INSERT INTO source_documents (
                  id, file_name, path, archive_path, type, document_kind,
                  size_bytes, chapter_id, chapter_number, processing_status,
                  metadata, updated_at
                )
                VALUES (
                  :id, :file_name, :path, NULL, :type, :document_kind,
                  NULL, NULL, NULL, 'imported', CAST(:metadata AS jsonb), now()
                )
                ON CONFLICT (id) DO UPDATE SET
                  file_name = EXCLUDED.file_name,
                  path = EXCLUDED.path,
                  type = EXCLUDED.type,
                  document_kind = EXCLUDED.document_kind,
                  processing_status = EXCLUDED.processing_status,
                  metadata = EXCLUDED.metadata,
                  updated_at = now()
                """
            ),
            {
                **doc,
                "metadata": _json(
                    {
                        "source_collection": source_collection,
                        "source_role": "canonical_textbook",
                        "authority_level": "primary",
                    }
                ),
            },
        )
        count += 1
    return count


def insert_chunks(session: Any, chunks: list[dict[str, Any]]) -> int:
    for index, chunk in enumerate(chunks):
        source_collection = str(chunk.get("source_collection") or "")
        doc = SOURCE_DOCUMENTS.get(source_collection)
        if not doc:
            raise ValueError(f"Unsupported source_collection for chunk {chunk.get('chunk_id')}: {source_collection}")
        clean_text = str(chunk.get("clean_text_for_embedding") or "").strip()
        raw_markdown = chunk.get("raw_markdown") or clean_text
        if not clean_text:
            raise ValueError(f"Canonical chunk has empty clean_text_for_embedding: {chunk.get('chunk_id')}")
        content_type = str(chunk.get("content_type") or "").strip()
        tags = [item for item in [source_collection, content_type] if item]
        session.execute(
            text(
                """
                INSERT INTO source_chunks (
                  id, document_id, chapter_id, page_number, section_title,
                  chunk_index, text, markdown, related_knowledge_point_ids,
                  related_experiment_ids, tags, metadata, review_required,
                  content_status, published_at, updated_at
                )
                VALUES (
                  :id, :document_id, :chapter_id, :page_number, :section_title,
                  :chunk_index, :text, :markdown, '{}'::text[],
                  '{}'::text[], :tags, CAST(:metadata AS jsonb), false,
                  'published', now(), now()
                )
                ON CONFLICT (id) DO UPDATE SET
                  document_id = EXCLUDED.document_id,
                  chapter_id = EXCLUDED.chapter_id,
                  page_number = EXCLUDED.page_number,
                  section_title = EXCLUDED.section_title,
                  chunk_index = EXCLUDED.chunk_index,
                  text = EXCLUDED.text,
                  markdown = EXCLUDED.markdown,
                  tags = EXCLUDED.tags,
                  metadata = EXCLUDED.metadata,
                  review_required = false,
                  content_status = 'published',
                  published_at = COALESCE(source_chunks.published_at, now()),
                  updated_at = now()
                """
            ),
            {
                "id": chunk["chunk_id"],
                "document_id": doc["id"],
                "chapter_id": _chapter_id(chunk),
                "page_number": chunk.get("page_start"),
                "section_title": _section_title(chunk),
                "chunk_index": index + 1,
                "text": clean_text,
                "markdown": raw_markdown,
                "tags": tags,
                "metadata": _json(_metadata(chunk, Path(str(chunk["_source_path"])))),
            },
        )
    return len(chunks)


def _load_embedding_row_map(embedding_dir: Path) -> dict[str, int]:
    mapping_path = embedding_dir / "chunk_id_to_row.jsonl"
    mapping: dict[str, int] = {}
    with mapping_path.open("r", encoding="utf-8-sig") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            mapping[str(row["chunk_id"])] = int(row["row"])
    return mapping


def _vector_literal(values: np.ndarray) -> str:
    return "[" + ",".join(f"{float(value):.8g}" for value in values) + "]"


def insert_embeddings(session: Any, chunks: list[dict[str, Any]], embedding_dir: Path) -> int:
    dense_path = embedding_dir / "dense.float32.npy"
    if not dense_path.exists():
        raise FileNotFoundError(dense_path)
    row_map = _load_embedding_row_map(embedding_dir)
    dense = np.load(dense_path, mmap_mode="r")
    if dense.shape != (len(row_map), EMBEDDING_DIMENSION):
        raise ValueError(f"Unexpected dense embedding shape: {dense.shape}")

    count = 0
    for chunk in chunks:
        chunk_id = str(chunk["chunk_id"])
        row_index = row_map.get(chunk_id)
        if row_index is None:
            raise ValueError(f"Embedding row missing for {chunk_id}")
        vector_literal = _vector_literal(dense[row_index])
        session.execute(
            text(
                """
                INSERT INTO chunk_embeddings (chunk_id, embedding, model, dimension, metadata)
                VALUES (:chunk_id, CAST(:embedding AS vector), :model, :dimension, CAST(:metadata AS jsonb))
                ON CONFLICT (chunk_id) DO UPDATE SET
                  embedding = EXCLUDED.embedding,
                  model = EXCLUDED.model,
                  dimension = EXCLUDED.dimension,
                  metadata = EXCLUDED.metadata
                """
            ),
            {
                "chunk_id": chunk_id,
                "embedding": vector_literal,
                "model": EMBEDDING_MODEL,
                "dimension": EMBEDDING_DIMENSION,
                "metadata": _json({"import_version": "canonical_base_v1", "embedding_dir": str(embedding_dir)}),
            },
        )
        count += 1
    return count


def import_canonical_evidence(
    *,
    chunk_files: list[Path],
    embedding_dir: Path,
    skip_embeddings: bool,
    skip_migrations: bool,
) -> dict[str, Any]:
    if not skip_migrations:
        apply_migrations()
    chunks = load_chunks(chunk_files)
    with db_session() as session:
        cleanup = cleanup_legacy_rows(session)
        document_count = insert_source_documents(session)
        chunk_count = insert_chunks(session, chunks)
        embedding_count = 0 if skip_embeddings else insert_embeddings(session, chunks, embedding_dir)
        if not skip_embeddings:
            ensure_embedding_index(session)
    return {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "cleanup": cleanup,
        "source_documents": document_count,
        "source_chunks": chunk_count,
        "chunk_embeddings": embedding_count,
        "embedding_model": None if skip_embeddings else EMBEDDING_MODEL,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import canonical chemistry RAG evidence into Postgres.")
    parser.add_argument("--chunk-file", action="append", type=Path, dest="chunk_files")
    parser.add_argument("--embedding-dir", type=Path, default=DEFAULT_EMBEDDING_DIR)
    parser.add_argument("--skip-embeddings", action="store_true")
    parser.add_argument("--skip-migrations", action="store_true")
    args = parser.parse_args()

    result = import_canonical_evidence(
        chunk_files=args.chunk_files or DEFAULT_CHUNK_FILES,
        embedding_dir=args.embedding_dir,
        skip_embeddings=args.skip_embeddings,
        skip_migrations=args.skip_migrations,
    )
    sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
