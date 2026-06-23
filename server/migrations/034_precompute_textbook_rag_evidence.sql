ALTER TABLE experiment_catalog_point_evidence_state
  DROP CONSTRAINT IF EXISTS experiment_catalog_point_evidence_state_evidence_status_check;

ALTER TABLE experiment_catalog_point_evidence_state
  ADD CONSTRAINT experiment_catalog_point_evidence_state_evidence_status_check
  CHECK (evidence_status IN ('missing', 'pending', 'running', 'succeeded', 'partial', 'failed', 'stale', 'disabled', 'unavailable'));

ALTER TABLE experiment_catalog_point_evidence_state
  ADD COLUMN IF NOT EXISTS content_fingerprint text,
  ADD COLUMN IF NOT EXISTS config_fingerprint text;

ALTER TABLE experiment_catalog_point_evidence_bindings
  DROP CONSTRAINT IF EXISTS experiment_catalog_point_evidence_bindings_evidence_role_check;

ALTER TABLE experiment_catalog_point_evidence_bindings
  ADD CONSTRAINT experiment_catalog_point_evidence_bindings_evidence_role_check
  CHECK (evidence_role IN ('experiment', 'theory', 'supplemental', 'fallback', 'dynamic_rag', 'principle', 'phenomenon', 'safety'));

ALTER TABLE experiment_catalog_point_evidence_bindings
  DROP CONSTRAINT IF EXISTS experiment_catalog_point_evidence_bindings_chunk_id_fkey;

ALTER TABLE experiment_catalog_point_evidence_bindings
  ADD COLUMN IF NOT EXISTS content_fingerprint text,
  ADD COLUMN IF NOT EXISTS config_fingerprint text;

DROP TABLE IF EXISTS textbook_rag_evidence_cache;

CREATE INDEX IF NOT EXISTS idx_catalog_point_evidence_state_fingerprints
  ON experiment_catalog_point_evidence_state(content_fingerprint, config_fingerprint);

CREATE INDEX IF NOT EXISTS idx_catalog_point_evidence_bindings_textbook_roles
  ON experiment_catalog_point_evidence_bindings(node_id, evidence_role, freshness_status, rank)
  WHERE evidence_role IN ('principle', 'phenomenon', 'safety');
