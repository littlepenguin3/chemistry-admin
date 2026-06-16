CREATE TABLE IF NOT EXISTS experiment_video_point_evidence (
  experiment_id text NOT NULL REFERENCES formal_experiments(id) ON DELETE CASCADE,
  point_key text NOT NULL,
  experiment_code text,
  point_title text NOT NULL,
  experiment_chunk_ids text[] NOT NULL DEFAULT '{}',
  theory_chunk_ids text[] NOT NULL DEFAULT '{}',
  manual_reviewed boolean NOT NULL DEFAULT false,
  review_grade text NOT NULL DEFAULT 'usable' CHECK (review_grade IN ('pass', 'usable', 'weak_but_best_available')),
  source_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, point_key)
);

CREATE INDEX IF NOT EXISTS idx_experiment_video_point_evidence_grade
  ON experiment_video_point_evidence(review_grade);

CREATE INDEX IF NOT EXISTS idx_experiment_video_point_evidence_chunks
  ON experiment_video_point_evidence USING gin(experiment_chunk_ids);

CREATE INDEX IF NOT EXISTS idx_experiment_video_point_evidence_theory_chunks
  ON experiment_video_point_evidence USING gin(theory_chunk_ids);
