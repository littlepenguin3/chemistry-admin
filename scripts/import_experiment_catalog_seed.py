from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app.domains.catalog_tree.catalog_seed import CATALOG_TREE_SEED_PATH, export_catalog_seed, import_catalog_seed
from server.app.infrastructure.database import apply_migrations, db_session

DEFAULT_IMPORT_REPORT = ROOT / "artifacts" / "catalog_outline_seed_import_report.json"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Validate and upsert the canonical catalog outline seed. The default path preserves current "
            "question banks, questions, catalog-node evidence, media bindings, canonical chunks, search "
            "dictionaries, users, roles, courses, and student learning data."
        )
    )
    parser.add_argument("--skip-migrations", action="store_true")
    parser.add_argument(
        "--reset-retired-legacy",
        action="store_true",
        help="Destructively clear only retired legacy seed-derived rows before importing.",
    )
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate only; do not write database rows.")
    parser.add_argument(
        "--include-point-content",
        action="store_true",
        help="Also import the legacy 76-record point_content_seed.json. The production bootstrap imports full_point_content_seed.json separately.",
    )
    parser.add_argument(
        "--export-current",
        action="store_true",
        help="Export the currently imported catalog tree from the database to catalog_tree.json.",
    )
    parser.add_argument("--catalog-output", type=Path, default=CATALOG_TREE_SEED_PATH)
    parser.add_argument("--report", type=Path, default=DEFAULT_IMPORT_REPORT)
    args = parser.parse_args()

    if args.dry_run:
        from server.app.domains.catalog_tree.catalog_seed import load_catalog_seed, validate_catalog_seed, validate_catalog_seed_files

        result = (
            validate_catalog_seed_files()
            if args.include_point_content
            else {
                **validate_catalog_seed(load_catalog_seed(args.catalog_output)),
                "catalog_seed": str(args.catalog_output.relative_to(ROOT).as_posix()),
                "point_content_seed": None,
            }
        )
        sys.stdout.buffer.write((json.dumps({"dry_run": True, **result}, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        if not result["ok"]:
            raise SystemExit(1)
        return

    if not args.skip_migrations:
        apply_migrations()

    if args.export_current:
        with db_session() as session:
            payload = export_catalog_seed(session)
        args.catalog_output.parent.mkdir(parents=True, exist_ok=True)
        args.catalog_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result = {
            "exported": True,
            "catalog_output": str(args.catalog_output),
            "canonical_points": len(payload.get("canonical_points") or []),
            "catalog_nodes": len(payload.get("nodes") or []),
        }
        sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        return

    with db_session() as session:
        result = import_catalog_seed(
            session,
            include_point_content=args.include_point_content,
            reset=args.reset_retired_legacy and not args.no_reset,
        )

    payload = {
        "report_type": "catalog_outline_seed_import_report",
        "created_at": datetime.now(timezone.utc).isoformat(),
        **result,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.stdout.buffer.write((json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
