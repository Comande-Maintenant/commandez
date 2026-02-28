-- Restaurant tablets table
CREATE TABLE IF NOT EXISTS restaurant_tablets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  serial_number varchar(20) NOT NULL UNIQUE,
  name text DEFAULT '',
  usage_type text NOT NULL DEFAULT 'autre' CHECK (usage_type IN ('cuisine', 'caisse', 'service_client', 'autre')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  activated_at timestamptz DEFAULT now(),
  deactivated_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by restaurant
CREATE INDEX IF NOT EXISTS idx_restaurant_tablets_restaurant_id ON restaurant_tablets(restaurant_id);

-- RLS
ALTER TABLE restaurant_tablets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their restaurant tablets"
  ON restaurant_tablets
  FOR ALL
  USING (true)
  WITH CHECK (true);
