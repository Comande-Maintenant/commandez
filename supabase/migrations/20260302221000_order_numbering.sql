-- 020: Daily order numbering with payment method prefix
-- Adds daily_number (reset per day per restaurant) and payment_method to orders

-- 1. Add columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_number INT;

-- 2. Create daily_order_counters table
CREATE TABLE IF NOT EXISTS daily_order_counters (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_date DATE NOT NULL,
  counter INT NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, order_date)
);

-- 3. Trigger function: atomically increment counter and set daily_number
CREATE OR REPLACE FUNCTION set_daily_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO daily_order_counters (restaurant_id, order_date, counter)
  VALUES (NEW.restaurant_id, CURRENT_DATE, 1)
  ON CONFLICT (restaurant_id, order_date)
  DO UPDATE SET counter = daily_order_counters.counter + 1
  RETURNING counter INTO next_num;

  NEW.daily_number := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger on orders BEFORE INSERT
DROP TRIGGER IF EXISTS trg_set_daily_number ON orders;
CREATE TRIGGER trg_set_daily_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_daily_order_number();

-- 5. Update CHECK constraint on order_type to include POS types
-- First drop any existing constraint (safe: IF EXISTS not supported on all PG versions, use DO block)
DO $$
BEGIN
  -- Try to drop the old constraint if it exists
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Add updated constraint with all order types
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('collect', 'delivery', 'pickup', 'dine_in', 'sur_place', 'a_emporter', 'telephone'));

-- 6. RLS on daily_order_counters
ALTER TABLE daily_order_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read daily_order_counters"
  ON daily_order_counters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert daily_order_counters"
  ON daily_order_counters FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update daily_order_counters"
  ON daily_order_counters FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role and triggers bypass RLS, but anon needs insert/update for the trigger
CREATE POLICY "Anon can read daily_order_counters"
  ON daily_order_counters FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert daily_order_counters"
  ON daily_order_counters FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update daily_order_counters"
  ON daily_order_counters FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
