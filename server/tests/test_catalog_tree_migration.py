from __future__ import annotations

from pathlib import Path


MIGRATION = Path("server/migrations/020_experiment_catalog_tree.sql")
SEPARATE_NODE_KIND_MIGRATION = Path("server/migrations/021_separate_catalog_directory_point_nodes.sql")


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def _separate_sql() -> str:
    return SEPARATE_NODE_KIND_MIGRATION.read_text(encoding="utf-8")


def test_catalog_tree_migration_uses_deterministic_legacy_identity_mapping() -> None:
    sql = _sql()

    assert "'cat-exp-' || left(encode(digest(convert_to(fe.id, 'UTF8'), 'sha1'), 'hex'), 24)" in sql
    assert "'cat-point-' || left(encode(digest(convert_to(evp.experiment_id || '::' || evp.point_key, 'UTF8'), 'sha1'), 'hex'), 24)" in sql
    assert "CREATE TABLE IF NOT EXISTS experiment_catalog_legacy_identity_map" in sql
    assert "UNIQUE (legacy_kind, legacy_experiment_id, legacy_point_key)" in sql
    assert "legacy_identity, legacy_kind, legacy_experiment_id, legacy_point_key, catalog_node_id" in sql


def test_catalog_tree_migration_backfills_point_content_media_links_and_questions() -> None:
    sql = _sql()

    assert "INSERT INTO experiment_catalog_point_content" in sql
    assert "teacher_note, principle_mode, principle_equation, principle_text" in sql
    assert "''" in sql
    assert "INSERT INTO experiment_catalog_point_media_bindings" in sql
    assert "INSERT INTO experiment_catalog_point_related_links" in sql
    assert "ALTER TABLE experiment_questions" in sql
    assert "ADD COLUMN IF NOT EXISTS primary_point_node_ids" in sql
    assert "'primary_point_node_ids', question_points.point_node_ids_json" in sql


def test_catalog_tree_migration_backfills_evidence_assessment_events_and_feedback() -> None:
    sql = _sql()

    assert "ALTER TABLE experiment_video_point_evidence" in sql
    assert "ADD COLUMN IF NOT EXISTS point_node_id text REFERENCES experiment_catalog_nodes" in sql
    assert "ALTER TABLE experiment_question_attempts" in sql
    assert "idx_experiment_question_attempts_point_node" in sql
    assert "ALTER TABLE student_events" in sql
    assert "idx_student_events_point_node" in sql
    assert "ALTER TABLE student_posttest_sessions" in sql
    assert "point_node_ids jsonb NOT NULL DEFAULT '[]'::jsonb" in sql
    assert "ALTER TABLE student_feedback" in sql
    assert "idx_student_feedback_point_node" in sql


def test_separate_catalog_node_kind_migration_adds_card_fields_and_tightens_kind_constraint() -> None:
    sql = _separate_sql()

    assert "ADD COLUMN IF NOT EXISTS teacher_note text NOT NULL DEFAULT ''" in sql
    assert "ADD COLUMN IF NOT EXISTS student_description text NOT NULL DEFAULT ''" in sql
    assert "ADD COLUMN IF NOT EXISTS card_image_asset_id uuid REFERENCES media_assets" in sql
    assert "ADD COLUMN IF NOT EXISTS point_card_presentation jsonb NOT NULL DEFAULT '{}'::jsonb" in sql
    assert "DROP COLUMN IF EXISTS shortcut_target_node_id" in sql
    assert "CHECK (node_kind IN ('directory', 'point'))" in sql


def test_separate_catalog_node_kind_migration_splits_hybrid_refs_deterministically() -> None:
    sql = _separate_sql()

    assert "n.id || '::hybrid-point'" in sql
    assert "split_role', 'point_child'" in sql
    assert "experiment_catalog_point_search_index_state si" in sql
    assert "OR EXISTS (SELECT 1 FROM experiment_video_point_evidence evidence WHERE evidence.point_node_id = n.id)" in sql
    assert "UPDATE experiment_catalog_point_content pc" in sql
    assert "UPDATE experiment_catalog_point_media_bindings mb" in sql
    assert "UPDATE experiment_catalog_point_related_links rl" in sql
    assert "UPDATE experiment_video_point_evidence evidence" in sql
    assert "UPDATE experiment_question_attempts attempts" in sql
    assert "UPDATE student_events events" in sql
    assert "UPDATE student_feedback feedback" in sql
    assert "UPDATE student_experiment_mastery mastery" in sql
    assert "UPDATE experiment_questions questions" in sql
    assert "UPDATE student_posttest_sessions sessions" in sql


def test_separate_catalog_node_kind_migration_does_not_preserve_index_only_split_points() -> None:
    sql = _separate_sql()

    assert "single search index state is not a point resource" not in sql
    assert "AND NOT EXISTS (SELECT 1 FROM experiment_catalog_point_content pc WHERE pc.node_id = n.id)" in sql
    assert "AND NOT EXISTS (SELECT 1 FROM experiment_catalog_point_media_bindings mb WHERE mb.node_id = n.id)" in sql
    assert "AND NOT EXISTS (SELECT 1 FROM experiment_catalog_legacy_identity_map lm WHERE lm.catalog_node_id = n.id AND lm.legacy_kind = 'experiment_point')" in sql
    assert "DELETE FROM experiment_catalog_nodes n" in sql


def test_separate_catalog_node_kind_migration_archives_shortcuts_with_audit_metadata() -> None:
    sql = _separate_sql()

    assert "WHERE node_kind = 'shortcut'" in sql
    assert "'from_node_kind', 'shortcut'" in sql
    assert "'legacy_shortcut_target_node_id', shortcut_target_node_id" in sql
    assert "status = 'archived'" in sql
