-- Reordered from legacy numeric prefix so clean database replays follow Git chronology.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
