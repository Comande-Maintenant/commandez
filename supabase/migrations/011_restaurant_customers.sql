CREATE TABLE restaurant_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_email text DEFAULT '',
  first_order_at timestamptz,
  last_order_at timestamptz,
  total_orders integer DEFAULT 0,
  total_spent numeric(10,2) DEFAULT 0,
  average_basket numeric(8,2) DEFAULT 0,
  favorite_items jsonb DEFAULT '[]',
  last_items jsonb DEFAULT '[]',
  is_banned boolean DEFAULT false,
  banned_at timestamptz,
  banned_reason text DEFAULT '',
  ban_expires_at timestamptz,
  banned_ip text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, customer_phone)
);
CREATE INDEX idx_rc_restaurant_id ON restaurant_customers(restaurant_id);
CREATE INDEX idx_rc_phone ON restaurant_customers(customer_phone);
CREATE INDEX idx_rc_banned ON restaurant_customers(restaurant_id, is_banned) WHERE is_banned = true;

ALTER TABLE restaurant_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_customers_select" ON restaurant_customers FOR SELECT USING (true);
CREATE POLICY "restaurant_customers_insert" ON restaurant_customers FOR INSERT WITH CHECK (true);
CREATE POLICY "restaurant_customers_update" ON restaurant_customers FOR UPDATE USING (true);
