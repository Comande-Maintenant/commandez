-- Reordered from legacy numeric prefix so clean database replays follow Git chronology.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text DEFAULT '';
