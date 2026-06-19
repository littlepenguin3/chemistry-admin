from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.infrastructure.database import apply_migrations, db_session
from server.app.experiment_framework import build_experiment_framework_overview

EXPECTED_CHUNKS = 349


def main() -> None:
    apply_migrations()
    with db_session() as session:
        overview = build_experiment_framework_overview(session)
    metrics = overview.get("metrics") or {}
    errors: list[str] = []
    if not overview.get("available"):
        errors.append("experiment framework is not available")
    if int(metrics.get("linked_chunk_count") or 0) != EXPECTED_CHUNKS:
        errors.append(f"expected {EXPECTED_CHUNKS} linked chunks, got {metrics.get('linked_chunk_count')}")
    if int(metrics.get("canonical_chunk_count") or 0) < EXPECTED_CHUNKS:
        errors.append(f"expected at least {EXPECTED_CHUNKS} canonical chunks, got {metrics.get('canonical_chunk_count')}")
    if int(metrics.get("formal_experiment_count") or 0) <= 0:
        errors.append("formal experiment links are empty")

    result = {
        "ok": not errors,
        "errors": errors,
        "source": overview.get("source"),
        "metrics": metrics,
        "root_count": len(overview.get("roots") or []),
    }
    sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
