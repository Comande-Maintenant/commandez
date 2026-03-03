-- 023_demo_setup.sql
-- Demo mode: cleanup test data, convert restaurant to demo, create RPCs

-- ============================================================
-- 1a. Add is_demo column to restaurants
-- ============================================================
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 1b. Delete 5 test restaurants (cascade order)
-- ============================================================

-- Orders
DELETE FROM orders WHERE restaurant_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Menu items
DELETE FROM menu_items WHERE restaurant_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Restaurant customers
DELETE FROM restaurant_customers WHERE restaurant_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Restaurant hours
DELETE FROM restaurant_hours WHERE restaurant_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Subscriptions
DELETE FROM subscriptions WHERE restaurant_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Referrals
DELETE FROM referrals WHERE referrer_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
) OR referee_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Promo code uses (if exists)
DELETE FROM promo_code_uses WHERE restaurant_id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Restaurant tablets (if exists)
DO $$ BEGIN
  DELETE FROM restaurant_tablets WHERE restaurant_id IN (
    '6ee1bb01-a016-4155-b477-dbbcd39a546e',
    'c236aa92-cab3-4aa1-a337-7767770cb764',
    'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
    '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
    '5851fb10-c351-4c2c-b312-568090418d01'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Now delete the 5 restaurants (NOT the demo one #81079f24)
DELETE FROM restaurants WHERE id IN (
  '6ee1bb01-a016-4155-b477-dbbcd39a546e',
  'c236aa92-cab3-4aa1-a337-7767770cb764',
  'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
  '17e7a5b7-52f5-4f64-a09b-1fdec84ff3d4',
  '5851fb10-c351-4c2c-b312-568090418d01'
);

-- Delete demo user from auth.users
DELETE FROM auth.users WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Storage objects cleanup skipped (must use Storage API)

-- ============================================================
-- 1c. Convert restaurant #4 to demo
-- ============================================================
UPDATE restaurants SET
  slug = 'demo',
  name = 'Antalya Kebab',
  subscription_status = 'active',
  is_demo = true,
  is_open = true,
  is_accepting_orders = true,
  owner_id = NULL,
  restaurant_phone = '06 00 00 00 00'
WHERE id = '81079f24-9e36-4c5b-b874-3eee6aa849d5';

-- Remove any pending subscription for the demo restaurant
DELETE FROM subscriptions WHERE restaurant_id = '81079f24-9e36-4c5b-b874-3eee6aa849d5';

-- ============================================================
-- 1d. Insert restaurant hours for demo
-- ============================================================
-- Delete existing hours first
DELETE FROM restaurant_hours WHERE restaurant_id = '81079f24-9e36-4c5b-b874-3eee6aa849d5';

-- One row per day (unique constraint on restaurant_id + day_of_week)
-- Multi-slot info is in the schedule JSON column
INSERT INTO restaurant_hours (restaurant_id, day_of_week, is_open, open_time, close_time)
VALUES
  ('81079f24-9e36-4c5b-b874-3eee6aa849d5', 0, false, '00:00', '00:00'),
  ('81079f24-9e36-4c5b-b874-3eee6aa849d5', 1, true, '11:00', '22:00'),
  ('81079f24-9e36-4c5b-b874-3eee6aa849d5', 2, true, '11:00', '22:00'),
  ('81079f24-9e36-4c5b-b874-3eee6aa849d5', 3, true, '11:00', '22:00'),
  ('81079f24-9e36-4c5b-b874-3eee6aa849d5', 4, true, '11:00', '22:00'),
  ('81079f24-9e36-4c5b-b874-3eee6aa849d5', 5, true, '11:00', '23:00'),
  ('81079f24-9e36-4c5b-b874-3eee6aa849d5', 6, true, '11:00', '23:00');

-- Also set the schedule JSON for auto mode
UPDATE restaurants SET
  availability_mode = 'auto',
  schedule = '[
    {"day":0,"enabled":false,"slots":[]},
    {"day":1,"enabled":true,"slots":[{"open":"11:00","close":"14:00"},{"open":"18:00","close":"22:00"}]},
    {"day":2,"enabled":true,"slots":[{"open":"11:00","close":"14:00"},{"open":"18:00","close":"22:00"}]},
    {"day":3,"enabled":true,"slots":[{"open":"11:00","close":"14:00"},{"open":"18:00","close":"22:00"}]},
    {"day":4,"enabled":true,"slots":[{"open":"11:00","close":"14:00"},{"open":"18:00","close":"22:00"}]},
    {"day":5,"enabled":true,"slots":[{"open":"11:00","close":"14:00"},{"open":"18:00","close":"23:00"}]},
    {"day":6,"enabled":true,"slots":[{"open":"11:00","close":"14:00"},{"open":"18:00","close":"23:00"}]}
  ]'::jsonb
WHERE id = '81079f24-9e36-4c5b-b874-3eee6aa849d5';

-- ============================================================
-- 1e. Create 3 RPCs for demo access (SECURITY DEFINER)
-- ============================================================

-- RPC: get_demo_orders - returns orders only if restaurant is_demo
CREATE OR REPLACE FUNCTION get_demo_orders(p_restaurant_id UUID)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return data if the restaurant is a demo
  IF EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND is_demo = true) THEN
    RETURN QUERY
      SELECT * FROM orders
      WHERE restaurant_id = p_restaurant_id
      ORDER BY created_at DESC;
  END IF;
END;
$$;

-- RPC: get_demo_customers - returns customers only if restaurant is_demo
CREATE OR REPLACE FUNCTION get_demo_customers(p_restaurant_id UUID)
RETURNS SETOF restaurant_customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND is_demo = true) THEN
    RETURN QUERY
      SELECT * FROM restaurant_customers
      WHERE restaurant_id = p_restaurant_id
      ORDER BY total_spent DESC;
  END IF;
END;
$$;

-- RPC: get_demo_restaurant - returns restaurant by slug only if is_demo
CREATE OR REPLACE FUNCTION get_demo_restaurant(p_slug TEXT)
RETURNS SETOF restaurants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM restaurants
    WHERE slug = p_slug AND is_demo = true
    LIMIT 1;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION get_demo_orders(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_demo_customers(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_demo_restaurant(TEXT) TO anon, authenticated;
