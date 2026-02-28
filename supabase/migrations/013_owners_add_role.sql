ALTER TABLE owners ADD COLUMN IF NOT EXISTS role text DEFAULT 'owner'
  CHECK (role IN ('owner', 'super_admin'));
