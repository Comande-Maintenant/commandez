ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
