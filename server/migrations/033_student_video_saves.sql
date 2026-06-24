CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS student_video_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  save_type text NOT NULL CHECK (save_type IN ('watch_later', 'favorite')),
  placement_node_id text NOT NULL REFERENCES experiment_catalog_nodes(id) ON DELETE CASCADE,
  canonical_point_id text NOT NULL REFERENCES experiment_catalog_points(id) ON DELETE RESTRICT,
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'unknown',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (placement_node_id = btrim(placement_node_id)),
  CHECK (canonical_point_id = btrim(canonical_point_id)),
  CHECK (length(btrim(placement_node_id)) > 0),
  CHECK (length(btrim(canonical_point_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_video_saves_unique_item
  ON student_video_saves(student_id, save_type, placement_node_id, media_asset_id);

CREATE INDEX IF NOT EXISTS idx_student_video_saves_active_by_student
  ON student_video_saves(student_id, save_type, updated_at DESC)
  WHERE archived_at IS NULL;
