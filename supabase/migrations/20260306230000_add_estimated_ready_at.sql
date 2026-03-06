-- Add estimated_ready_at column for per-order prep time estimation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_at timestamptz DEFAULT NULL;

-- Allow update of this column (already covered by existing RLS policies)
