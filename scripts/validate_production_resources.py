from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "seed" / "manifests" / "core_resources.json"

EXPECTED_DATABASE_COUNTS = {
    "formal_experiments_active": 77,
    "chapters": 11,
    "knowledge_units": 133,
    "knowledge_points": 385,
    "experiment_points": 300,
    "experiment_question_banks": 77,
    "experiment_questions": 2310,
    "source_documents": 2,
    "source_chunks": 3637,
    "chunk_embeddings": 3637,
    "point_evidence_bindings": 300,
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _jsonl_count(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig") as handle:
        return sum(1 for line in handle if line.strip())


def _formal_experiment_count(path: Path) -> int:
    return len(_json(path).get("experiments") or [])


def _json_list_count(path: Path) -> int:
    data = _json(path)
    if not isinstance(data, list):
        raise ValueError(f"{path} is not a JSON list")
    return len(data)


def _reviewed_curriculum_count(path: Path) -> dict[str, int]:
    data = _json(path)
    return {
        "chapters": len(data.get("chapters") or []),
        "knowledge_units": len(data.get("knowledge_units") or []),
        "knowledge_points": len(data.get("knowledge_points") or []),
    }


def _point_inventory_count(path: Path) -> dict[str, int]:
    data = _json(path)
    summary = data.get("summary") or {}
    return {
        "experiments": int(summary.get("experiment_count") or len(data.get("experiments") or [])),
        "points": int(summary.get("total_video_points") or 0),
    }


def _question_bank_count(path: Path) -> dict[str, int]:
    data = _json(path)
    experiments = data.get("experiments") or []
    return {
        "experiments": len(experiments),
        "questions": sum(len(experiment.get("questions") or []) for experiment in experiments),
    }


def _student_learning_profile_count(path: Path) -> dict[str, int]:
    required_cards = {
        "atomic_number",
        "electron_configuration",
        "group",
        "common_valence",
        "elemental_state",
        "redox",
    }
    data = _json(path)
    profiles = data.get("profiles") or []
    if not isinstance(profiles, list):
        raise ValueError(f"{path} profiles is not a JSON list")
    enabled = [profile for profile in profiles if isinstance(profile, dict) and profile.get("enabled", True)]
    for profile in enabled:
        profile_id = profile.get("profile_id") or "<missing>"
        for key in ["chapter_id", "title", "hero", "elements", "property_cards", "property_sections"]:
            if not profile.get(key):
                raise ValueError(f"{path} profile {profile_id} missing {key}")
        card_keys = {
            str(card.get("key") or "")
            for card in profile.get("property_cards") or []
            if isinstance(card, dict)
        }
        missing = sorted(required_cards - card_keys)
        if missing:
            raise ValueError(f"{path} profile {profile_id} missing property cards: {', '.join(missing)}")
    return {"profiles": len(profiles), "enabled_profiles": len(enabled)}


def _embedding_dense_count(path: Path) -> dict[str, int]:
    dense = np.load(path, mmap_mode="r")
    if len(dense.shape) != 2:
        raise ValueError(f"{path} is not a two-dimensional dense embedding matrix")
    return {"rows": int(dense.shape[0]), "dimensions": int(dense.shape[1])}


CountFn = Callable[[Path], int | dict[str, int] | None]


RESOURCE_SPECS: list[dict[str, Any]] = [
    {
        "id": "formal_experiments",
        "role": "Published formal experiment catalog",
        "path": "data/seed/formal_experiments.json",
        "kind": "json",
        "count": _formal_experiment_count,
        "expected_count": 77,
    },
    {
        "id": "knowledge_framework_chapters",
        "role": "Knowledge framework chapter fallback data",
        "path": "data/seed/knowledge_framework/chapters.json",
        "kind": "json",
        "count": _json_list_count,
        "expected_count": 11,
        "source_path": "data/processed/chapters.json",
    },
    {
        "id": "knowledge_framework_units",
        "role": "Knowledge framework unit fallback data",
        "path": "data/seed/knowledge_framework/knowledge_units.json",
        "kind": "json",
        "count": _json_list_count,
        "expected_count": 133,
        "source_path": "data/processed/knowledge_units.json",
    },
    {
        "id": "knowledge_framework_points",
        "role": "Knowledge framework point fallback data",
        "path": "data/seed/knowledge_framework/knowledge_points.json",
        "kind": "json",
        "count": _json_list_count,
        "expected_count": 385,
        "source_path": "data/processed/knowledge_points.json",
    },
    {
        "id": "reviewed_curriculum",
        "role": "Reviewed curriculum source used to publish framework fallback JSON",
        "path": "data/seed/knowledge_framework/reviewed_curriculum.json",
        "kind": "json",
        "count": _reviewed_curriculum_count,
        "expected_counts": {"chapters": 11, "knowledge_units": 133, "knowledge_points": 385},
        "source_path": "data/processed/reviewed_curriculum.json",
    },
    {
        "id": "experiment_point_inventory",
        "role": "Current formal experiment point inventory",
        "path": "data/seed/experiment_points/formal_experiment_point_inventory.json",
        "kind": "json",
        "count": _point_inventory_count,
        "expected_counts": {"experiments": 77, "points": 300},
        "source_path": "artifacts/point-aware-question-bank/formal_experiment_point_inventory.json",
    },
    {
        "id": "point_aware_question_bank",
        "role": "Current imported point-aware default question bank",
        "path": "data/seed/question_bank/rebuilt_question_bank_merged_v1.json",
        "kind": "json",
        "count": _question_bank_count,
        "expected_counts": {"experiments": 77, "questions": 2310},
        "source_path": "artifacts/point-aware-question-bank/reviewed_old_bank_chunks/slim_release_work_v1/rebuilt_question_bank_merged_v1.json",
    },
    {
        "id": "point_aware_question_bank_schema",
        "role": "Schema used to validate the point-aware question bank",
        "path": "data/seed/question_bank/point_aware_question_bank_schema.json",
        "kind": "json",
        "source_path": "artifacts/point-aware-question-bank/point_aware_question_bank_schema.json",
    },
    {
        "id": "manual_reviewed_point_evidence",
        "role": "Current manually reviewed experiment point to canonical chunk evidence bindings",
        "path": "data/seed/point_evidence/manual_reviewed_point_evidence.jsonl",
        "kind": "jsonl",
        "count": _jsonl_count,
        "expected_count": 300,
        "source_path": "artifacts/video-point-default-evidence/gpu-rerank-direct-v2-20260616T1140Z/manual-reviewed-from-start-20260616T2135Z/manual_reviewed_point_evidence.jsonl",
    },
    {
        "id": "manual_review_point_evidence_manifest",
        "role": "Manifest for the manually reviewed point evidence source run",
        "path": "data/seed/point_evidence/manual_review_manifest.json",
        "kind": "json",
        "source_path": "artifacts/video-point-default-evidence/gpu-rerank-direct-v2-20260616T1140Z/manual-reviewed-from-start-20260616T2135Z/manifest.json",
    },
    {
        "id": "student_learning_profiles",
        "role": "Student H5 display-facing family and element learning profiles",
        "path": "data/seed/student_learning/element_profiles.json",
        "kind": "json",
        "count": _student_learning_profile_count,
        "expected_counts": {"profiles": 9, "enabled_profiles": 9},
    },
    {
        "id": "canonical_chunks_inorganic_lower",
        "role": "Canonical inorganic textbook chunks",
        "path": "data/seed/canonical_rag/chunks/textbook_inorganic_lower_chunks_v1.jsonl",
        "kind": "jsonl",
        "count": _jsonl_count,
        "expected_count": 3288,
        "source_path": "E:/chemistry-rag/data/rag_ready/chunks/textbook_inorganic_lower_chunks_v1.jsonl",
    },
    {
        "id": "canonical_chunks_experiment",
        "role": "Canonical experiment textbook chunks",
        "path": "data/seed/canonical_rag/chunks/textbook_experiment_chunks_v1.jsonl",
        "kind": "jsonl",
        "count": _jsonl_count,
        "expected_count": 349,
        "source_path": "E:/chemistry-rag/data/rag_ready/chunks/textbook_experiment_chunks_v1.jsonl",
    },
    {
        "id": "canonical_embedding_row_map",
        "role": "Canonical BGE embedding row map",
        "path": "data/seed/canonical_rag/embeddings/canonical_base_v1/chunk_id_to_row.jsonl",
        "kind": "jsonl",
        "count": _jsonl_count,
        "expected_count": 3637,
        "source_path": "E:/chemistry-rag/data/rag_ready/embeddings/canonical_base_v1/chunk_id_to_row.jsonl",
    },
    {
        "id": "canonical_embedding_dense",
        "role": "Canonical BGE dense embeddings",
        "path": "data/seed/canonical_rag/embeddings/canonical_base_v1/dense.float32.npy",
        "kind": "npy",
        "count": _embedding_dense_count,
        "expected_counts": {"rows": 3637, "dimensions": 1024},
        "source_path": "E:/chemistry-rag/data/rag_ready/embeddings/canonical_base_v1/dense.float32.npy",
    },
    {
        "id": "canonical_embedding_sparse",
        "role": "Canonical sparse embedding sidecar",
        "path": "data/seed/canonical_rag/embeddings/canonical_base_v1/sparse.jsonl",
        "kind": "jsonl",
        "count": _jsonl_count,
        "expected_count": 3637,
        "source_path": "E:/chemistry-rag/data/rag_ready/embeddings/canonical_base_v1/sparse.jsonl",
    },
    {
        "id": "canonical_embedding_manifest",
        "role": "Canonical embedding generation manifest",
        "path": "data/seed/canonical_rag/embeddings/canonical_base_v1/embedding_manifest.json",
        "kind": "json",
        "source_path": "E:/chemistry-rag/data/rag_ready/embeddings/canonical_base_v1/embedding_manifest.json",
    },
    {
        "id": "knowledge_framework_import_report",
        "role": "Current experiment knowledge framework import report",
        "path": "data/seed/import_reports/experiment_knowledge_framework_import_report.json",
        "kind": "json",
        "source_path": "artifacts/experiment_knowledge_framework_import_report.json",
    },
    {
        "id": "point_aware_question_bank_import_report",
        "role": "Current point-aware question bank import report",
        "path": "data/seed/import_reports/rebuilt_question_bank_merged_v1_import_report.json",
        "kind": "json",
        "source_path": "artifacts/point-aware-question-bank/reviewed_old_bank_chunks/slim_release_work_v1/rebuilt_question_bank_merged_v1_import_report.json",
    },
]


def _relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _resource_entry(spec: dict[str, Any]) -> dict[str, Any]:
    path = ROOT / spec["path"]
    if not path.exists():
        raise FileNotFoundError(path)
    count_fn: CountFn | None = spec.get("count")
    count_value = count_fn(path) if count_fn else None
    entry = {
        "id": spec["id"],
        "role": spec["role"],
        "path": _relative(path),
        "source_path": spec.get("source_path"),
        "required": True,
        "kind": spec["kind"],
        "size_bytes": path.stat().st_size,
        "sha256": _sha256(path),
    }
    if count_value is not None:
        entry["count"] = count_value
    if "expected_count" in spec:
        entry["expected_count"] = spec["expected_count"]
    if "expected_counts" in spec:
        entry["expected_counts"] = spec["expected_counts"]
    return entry


def build_manifest() -> dict[str, Any]:
    return {
        "version": "production-core-resources-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "policy": (
            "These files are the protected current system resources. Destructive cleanup "
            "must validate this manifest before deleting or moving historical artifacts."
        ),
        "external_sources_mirrored": True,
        "expected_database_counts": EXPECTED_DATABASE_COUNTS,
        "resources": [_resource_entry(spec) for spec in RESOURCE_SPECS],
    }


def _compare_count(entry: dict[str, Any], actual: Any, errors: list[str]) -> None:
    if "expected_count" in entry and actual != entry["expected_count"]:
        errors.append(f"{entry['id']}: expected count {entry['expected_count']}, got {actual}")
    expected_counts = entry.get("expected_counts")
    if expected_counts:
        if not isinstance(actual, dict):
            errors.append(f"{entry['id']}: expected structured counts {expected_counts}, got {actual}")
            return
        for key, expected in expected_counts.items():
            if actual.get(key) != expected:
                errors.append(f"{entry['id']}.{key}: expected {expected}, got {actual.get(key)}")


def validate_manifest(manifest_path: Path = MANIFEST_PATH) -> dict[str, Any]:
    if not manifest_path.exists():
        raise FileNotFoundError(manifest_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_by_id = {entry["id"]: entry for entry in manifest.get("resources") or []}
    errors: list[str] = []
    actual_entries: list[dict[str, Any]] = []
    for spec in RESOURCE_SPECS:
        try:
            actual = _resource_entry(spec)
        except Exception as exc:  # noqa: BLE001 - validation should aggregate resource failures.
            errors.append(f"{spec['id']}: {exc}")
            continue
        actual_entries.append(actual)
        expected = expected_by_id.get(spec["id"])
        if expected is None:
            errors.append(f"{spec['id']}: missing from manifest")
            continue
        for key in ["path", "kind", "size_bytes", "sha256"]:
            if actual.get(key) != expected.get(key):
                errors.append(f"{spec['id']}.{key}: expected {expected.get(key)!r}, got {actual.get(key)!r}")
        _compare_count(actual, actual.get("count"), errors)
    extra = sorted(set(expected_by_id) - {spec["id"] for spec in RESOURCE_SPECS})
    for resource_id in extra:
        errors.append(f"{resource_id}: unknown resource remains in manifest")
    return {
        "ok": not errors,
        "errors": errors,
        "manifest": str(manifest_path),
        "resource_count": len(actual_entries),
        "expected_database_counts": EXPECTED_DATABASE_COUNTS,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate protected production seed resources.")
    parser.add_argument("--write-manifest", action="store_true", help="Regenerate the core resource manifest.")
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    args = parser.parse_args()

    if args.write_manifest:
        manifest = build_manifest()
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    result = validate_manifest(args.manifest)
    sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
