ALTER TABLE student_smart_assessment_sessions
ADD COLUMN IF NOT EXISTS assessment_mode text NOT NULL DEFAULT 'smart';

CREATE INDEX IF NOT EXISTS idx_student_smart_assessment_sessions_mode
ON student_smart_assessment_sessions(assessment_mode, status, created_at DESC);

CREATE TABLE IF NOT EXISTS class_custom_assessment_settings (
  class_id text PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
