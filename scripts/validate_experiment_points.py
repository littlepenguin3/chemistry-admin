from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("PGCONNECT_TIMEOUT", "5")

from server.app.infrastructure.database import db_session
from server.app.domains.experiment_points.canonical_points import candidate_point_key, validate_canonical_point_references


def main() -> None:
    try:
        with db_session() as session:
            candidate_rows = session.execute(
                text(
                    """
                    SELECT fe.id AS experiment_id, candidate.ordinality::int - 1 AS index, candidate.value::text AS title,
                           evp.point_key
                    FROM formal_experiments fe
                    CROSS JOIN LATERAL jsonb_array_elements_text(
                      CASE
                        WHEN jsonb_typeof(fe.metadata->'video_candidates') = 'array' THEN fe.metadata->'video_candidates'
                        ELSE '[]'::jsonb
                      END
                    ) WITH ORDINALITY AS candidate(value, ordinality)
                    LEFT JOIN experiment_video_points evp
                      ON evp.experiment_id = fe.id
                     AND evp.point_key = ('candidate-' || candidate.ordinality || '-' || substring(encode(digest(convert_to(btrim(candidate.value::text), 'UTF8'), 'sha1'), 'hex') for 8))
                    WHERE btrim(candidate.value::text) <> ''
                    """
                )
            ).mappings().all()
            point_count = int(session.execute(text("SELECT COUNT(*) FROM experiment_video_points")).scalar_one() or 0)
            published_content_count = int(
                session.execute(
                    text("SELECT COUNT(*) FROM experiment_point_learning_content WHERE content_status = 'published'")
                ).scalar_one()
                or 0
            )
    except SQLAlchemyError as exc:
        result = {
            "ok": False,
            "errors": [f"database unavailable for experiment point validation: {exc}"],
        }
        sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        raise SystemExit(1) from exc
    key_errors = [
        {
            "experiment_id": row["experiment_id"],
            "title": row["title"],
            "expected": candidate_point_key(int(row["index"]), str(row["title"])),
            "actual": row["point_key"],
        }
        for row in candidate_rows
        if row["point_key"] != candidate_point_key(int(row["index"]), str(row["title"]))
    ]
    refs = validate_canonical_point_references()
    errors: list[str] = []
    if key_errors:
        errors.append(f"candidate key stability errors: {len(key_errors)}")
    if not refs["ok"]:
        errors.extend(refs["errors"])
    result = {
        "ok": not errors,
        "errors": errors,
        "point_count": point_count,
        "published_content_count": published_content_count,
        "candidate_count": len(candidate_rows),
        "candidate_key_errors": key_errors[:20],
        "reference_validation": refs,
    }
    sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
