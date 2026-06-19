from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy import text

from server.app.infrastructure.database import db_session


def candidate_point_key(index: int, title: str) -> str:
    digest = hashlib.sha1(title.strip().encode("utf-8")).hexdigest()[:8]
    return f"candidate-{index + 1}-{digest}"


def validate_canonical_point_references() -> dict[str, Any]:
    with db_session() as session:
        unresolved_question_rows = session.execute(
            text(
                """
                SELECT q.experiment_id, point.point_key
                FROM experiment_questions q
                CROSS JOIN LATERAL jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(q.metadata->'primary_point_keys') = 'array' THEN q.metadata->'primary_point_keys'
                    ELSE '[]'::jsonb
                  END
                ) AS point(point_key)
                LEFT JOIN experiment_video_points evp
                  ON evp.experiment_id = q.experiment_id
                 AND evp.point_key = point.point_key
                WHERE point.point_key <> ''
                  AND evp.point_key IS NULL
                LIMIT 100
                """
            )
        ).mappings().all()
        unresolved_evidence_rows = session.execute(
            text(
                """
                SELECT e.experiment_id, e.point_key
                FROM experiment_video_point_evidence e
                LEFT JOIN experiment_video_points evp
                  ON evp.experiment_id = e.experiment_id
                 AND evp.point_key = e.point_key
                WHERE evp.point_key IS NULL
                LIMIT 100
                """
            )
        ).mappings().all()
        point_count = int(session.execute(text("SELECT COUNT(*) FROM experiment_video_points")).scalar_one() or 0)
    errors = []
    if unresolved_question_rows:
        errors.append(f"Unresolved question-bank point references: {len(unresolved_question_rows)} sample rows")
    if unresolved_evidence_rows:
        errors.append(f"Unresolved AI evidence point references: {len(unresolved_evidence_rows)} sample rows")
    return {
        "ok": not errors,
        "errors": errors,
        "point_count": point_count,
        "unresolved_question_refs": [dict(row) for row in unresolved_question_rows],
        "unresolved_evidence_refs": [dict(row) for row in unresolved_evidence_rows],
    }
