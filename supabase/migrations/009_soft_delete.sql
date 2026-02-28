ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deactivation_visit_count integer DEFAULT 0;
