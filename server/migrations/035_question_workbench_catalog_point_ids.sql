ALTER TABLE IF EXISTS experiment_question_workbench_sessions
  ADD COLUMN IF NOT EXISTS point_node_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_question_workbench_sessions_point_node_ids
  ON experiment_question_workbench_sessions USING gin(point_node_ids);
