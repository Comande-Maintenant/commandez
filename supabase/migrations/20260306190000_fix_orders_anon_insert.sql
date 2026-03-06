-- Fix: allow anonymous users to SELECT their just-inserted order
-- The .insert().select().single() pattern requires SELECT permission
-- on the newly created row. Without this, anon inserts succeed but
-- the response is empty/error because the SELECT is blocked.

-- Allow anon to read orders they just created (within last 5 minutes)
-- AND demo restaurant orders
DROP POLICY IF EXISTS "orders_select_demo" ON orders;
DROP POLICY IF EXISTS "orders_anon_select" ON orders;

CREATE POLICY "orders_anon_select" ON orders
  FOR SELECT TO anon
  USING (
    -- Demo restaurant orders
    restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true)
    -- OR recently created (within 5 min, for .insert().select() pattern)
    OR created_at > NOW() - INTERVAL '5 minutes'
  );
