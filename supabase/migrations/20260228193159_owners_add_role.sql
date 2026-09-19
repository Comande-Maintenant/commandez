-- Reordered from legacy numeric prefix so clean database replays follow Git chronology.
ALTER TABLE owners ADD COLUMN IF NOT EXISTS role text DEFAULT 'owner'
  CHECK (role IN ('owner', 'super_admin'));
