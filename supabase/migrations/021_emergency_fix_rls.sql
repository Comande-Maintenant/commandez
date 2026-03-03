-- ============================================================
-- 021: EMERGENCY - Fix wide-open RLS policies
--
-- Problem: Auto-generated Lovable migrations (20260226*) created
-- permissive policies (USING true) with different names than
-- 015_tighten_rls.sql. Since PostgreSQL OR-combines permissive
-- policies, the restrictive policies from 015 are ineffective.
--
-- Impact: Anyone with the public anon key can currently UPDATE/DELETE
-- any restaurant, menu item, order, etc.
--
-- Fix: Drop ALL existing policies, recreate correctly.
-- Add SECURITY DEFINER functions for cross-owner operations.
-- Add RPCs for anonymous order tracking (no public SELECT on orders).
-- ============================================================

BEGIN;

-- ==========================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- Bypass RLS for specific cross-owner operations
-- ==========================================

-- Validate order total server-side (called from OrderPage)
CREATE OR REPLACE FUNCTION validate_order_total(p_items JSONB, p_claimed_total NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  calculated_total NUMERIC := 0;
  item_price NUMERIC;
  supplement_total NUMERIC;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT price INTO item_price
    FROM menu_items
    WHERE id = (item.value->>'menu_item_id')::UUID;

    IF item_price IS NULL THEN
      RETURN FALSE;
    END IF;

    supplement_total := 0;
    IF item.value ? 'supplements' AND jsonb_array_length(item.value->'supplements') > 0 THEN
      SELECT COALESCE(SUM((s.value->>'price')::NUMERIC), 0) INTO supplement_total
      FROM jsonb_array_elements(item.value->'supplements') s;
    END IF;

    calculated_total := calculated_total + ((item_price + supplement_total) * COALESCE((item.value->>'quantity')::INT, 1));
  END LOOP;

  RETURN ABS(calculated_total - p_claimed_total) < 0.02;
END;
$$;

-- Increment deactivation visit count (called from RestaurantPage)
CREATE OR REPLACE FUNCTION increment_deactivation_visits(p_restaurant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE restaurants
  SET deactivation_visit_count = COALESCE(deactivation_visit_count, 0) + 1
  WHERE id = p_restaurant_id;
END;
$$;

-- Grant referral bonus to referrer (called during onboarding)
CREATE OR REPLACE FUNCTION grant_referral_bonus(p_referrer_id UUID, p_bonus_weeks INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE restaurants
  SET bonus_weeks = COALESCE(bonus_weeks, 0) + p_bonus_weeks
  WHERE id = p_referrer_id;
END;
$$;

-- Get order data for anonymous tracking (SuiviPage)
CREATE OR REPLACE FUNCTION get_order_for_tracking(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'daily_number', o.daily_number,
    'payment_method', o.payment_method,
    'status', o.status,
    'items', o.items,
    'subtotal', o.subtotal,
    'total', o.total,
    'order_type', o.order_type,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'customer_email', o.customer_email,
    'pickup_time', o.pickup_time,
    'created_at', o.created_at,
    'accepted_at', o.accepted_at,
    'ready_at', o.ready_at,
    'completed_at', o.completed_at,
    'restaurant_id', o.restaurant_id,
    'restaurant', jsonb_build_object(
      'name', r.name,
      'slug', r.slug,
      'primary_color', r.primary_color,
      'restaurant_phone', r.restaurant_phone
    )
  ) INTO result
  FROM orders o
  JOIN restaurants r ON r.id = o.restaurant_id
  WHERE o.id = p_order_id;

  RETURN result;
END;
$$;

-- Get active order count for a restaurant (RestaurantPage wait time)
CREATE OR REPLACE FUNCTION get_active_order_count(p_restaurant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM orders
  WHERE restaurant_id = p_restaurant_id
    AND status IN ('new', 'preparing');
  RETURN cnt;
END;
$$;

-- Link anonymous orders to a newly created user account
CREATE OR REPLACE FUNCTION link_orders_to_user(p_user_id UUID, p_email TEXT, p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_email IS NOT NULL AND p_email != '' THEN
    UPDATE orders
    SET customer_user_id = p_user_id
    WHERE customer_email = p_email
      AND customer_user_id IS NULL;
  END IF;

  IF p_phone IS NOT NULL AND p_phone != '' THEN
    UPDATE orders
    SET customer_user_id = p_user_id
    WHERE customer_phone = p_phone
      AND customer_user_id IS NULL;
  END IF;
END;
$$;

-- ==========================================
-- RESTAURANTS
-- ==========================================
DROP POLICY IF EXISTS "restaurants_public_insert" ON restaurants;
DROP POLICY IF EXISTS "restaurants_public_read" ON restaurants;
DROP POLICY IF EXISTS "restaurants_public_update" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select" ON restaurants;
DROP POLICY IF EXISTS "restaurants_insert" ON restaurants;
DROP POLICY IF EXISTS "restaurants_update" ON restaurants;
DROP POLICY IF EXISTS "restaurants_delete" ON restaurants;
DROP POLICY IF EXISTS "Allow public read access" ON restaurants;
DROP POLICY IF EXISTS "Allow authenticated insert" ON restaurants;
DROP POLICY IF EXISTS "Allow owner update" ON restaurants;
DROP POLICY IF EXISTS "Anyone can update restaurants" ON restaurants;

-- SELECT: public (customers view restaurant pages)
CREATE POLICY "restaurants_select" ON restaurants
  FOR SELECT USING (true);

-- INSERT: authenticated users only (onboarding)
CREATE POLICY "restaurants_insert" ON restaurants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: owner or super_admin only
CREATE POLICY "restaurants_update" ON restaurants
  FOR UPDATE USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- DELETE: owner or super_admin only
CREATE POLICY "restaurants_delete" ON restaurants
  FOR DELETE USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- MENU_ITEMS
-- ==========================================
DROP POLICY IF EXISTS "menu_items_public_read" ON menu_items;
DROP POLICY IF EXISTS "menu_items_public_insert" ON menu_items;
DROP POLICY IF EXISTS "menu_items_public_update" ON menu_items;
DROP POLICY IF EXISTS "menu_items_public_delete" ON menu_items;
DROP POLICY IF EXISTS "menu_items_select" ON menu_items;
DROP POLICY IF EXISTS "menu_items_insert" ON menu_items;
DROP POLICY IF EXISTS "menu_items_update" ON menu_items;
DROP POLICY IF EXISTS "menu_items_delete" ON menu_items;
DROP POLICY IF EXISTS "Anyone can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can update menu items" ON menu_items;
DROP POLICY IF EXISTS "Anyone can delete menu items" ON menu_items;
DROP POLICY IF EXISTS "Allow public read" ON menu_items;
DROP POLICY IF EXISTS "Allow insert" ON menu_items;
DROP POLICY IF EXISTS "Allow update" ON menu_items;
DROP POLICY IF EXISTS "Allow delete" ON menu_items;

-- SELECT: public (customers see menus)
CREATE POLICY "menu_items_select" ON menu_items
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: restaurant owner or super_admin
CREATE POLICY "menu_items_insert" ON menu_items
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "menu_items_update" ON menu_items
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "menu_items_delete" ON menu_items
  FOR DELETE USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- ORDERS
-- ==========================================
DROP POLICY IF EXISTS "orders_public_read" ON orders;
DROP POLICY IF EXISTS "orders_public_insert" ON orders;
DROP POLICY IF EXISTS "orders_public_update" ON orders;
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "Customers read own orders" ON orders;
DROP POLICY IF EXISTS "Orders can be updated" ON orders;
DROP POLICY IF EXISTS "Allow public read" ON orders;
DROP POLICY IF EXISTS "Allow insert" ON orders;
DROP POLICY IF EXISTS "Allow update" ON orders;

-- SELECT: owner sees their restaurant's orders, customer sees their own,
-- super_admin sees all. Anonymous uses RPC get_order_for_tracking().
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
    OR (auth.uid() IS NOT NULL AND auth.uid() = customer_user_id)
  );

-- INSERT: public (anonymous customers place orders)
CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (true);

-- UPDATE: restaurant owner or super_admin only
CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- RESTAURANT_HOURS
-- ==========================================
DROP POLICY IF EXISTS "hours_public_read" ON restaurant_hours;
DROP POLICY IF EXISTS "hours_public_insert" ON restaurant_hours;
DROP POLICY IF EXISTS "hours_public_update" ON restaurant_hours;
DROP POLICY IF EXISTS "restaurant_hours_select" ON restaurant_hours;
DROP POLICY IF EXISTS "restaurant_hours_insert" ON restaurant_hours;
DROP POLICY IF EXISTS "restaurant_hours_update" ON restaurant_hours;

-- SELECT: public (schedule shown on restaurant page)
CREATE POLICY "restaurant_hours_select" ON restaurant_hours
  FOR SELECT USING (true);

-- INSERT/UPDATE: restaurant owner or super_admin
CREATE POLICY "restaurant_hours_insert" ON restaurant_hours
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "restaurant_hours_update" ON restaurant_hours
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- RESTAURANT_CUSTOMERS
-- ==========================================
DROP POLICY IF EXISTS "restaurant_customers_insert" ON restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_select" ON restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_update" ON restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_select_owner" ON restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_insert_owner" ON restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_update_owner" ON restaurant_customers;

-- SELECT: restaurant owner or super_admin
CREATE POLICY "restaurant_customers_select" ON restaurant_customers
  FOR SELECT USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- INSERT: public (customer records created via order flow)
CREATE POLICY "restaurant_customers_insert" ON restaurant_customers
  FOR INSERT WITH CHECK (true);

-- UPDATE: restaurant owner or super_admin (ban management)
CREATE POLICY "restaurant_customers_update" ON restaurant_customers
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- RESTAURANT_TABLETS
-- ==========================================
DROP POLICY IF EXISTS "Authenticated users can manage their restaurant tablets" ON restaurant_tablets;
DROP POLICY IF EXISTS "restaurant_tablets_select" ON restaurant_tablets;
DROP POLICY IF EXISTS "restaurant_tablets_insert" ON restaurant_tablets;
DROP POLICY IF EXISTS "restaurant_tablets_update" ON restaurant_tablets;
DROP POLICY IF EXISTS "restaurant_tablets_delete" ON restaurant_tablets;

-- All operations: restaurant owner or super_admin
CREATE POLICY "restaurant_tablets_select" ON restaurant_tablets
  FOR SELECT USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "restaurant_tablets_insert" ON restaurant_tablets
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "restaurant_tablets_update" ON restaurant_tablets
  FOR UPDATE USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "restaurant_tablets_delete" ON restaurant_tablets
  FOR DELETE USING (
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- REFERRALS
-- ==========================================
DROP POLICY IF EXISTS "System can insert referrals" ON referrals;
DROP POLICY IF EXISTS "System can update referrals" ON referrals;
DROP POLICY IF EXISTS "Owner can view own referrals" ON referrals;
DROP POLICY IF EXISTS "referrals_select" ON referrals;
DROP POLICY IF EXISTS "referrals_insert" ON referrals;
DROP POLICY IF EXISTS "referrals_update" ON referrals;

-- SELECT: referrer owner or super_admin
CREATE POLICY "referrals_select" ON referrals
  FOR SELECT USING (
    referrer_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- INSERT: authenticated users (referrals created during onboarding)
CREATE POLICY "referrals_insert" ON referrals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: authenticated users (status updated during referral processing)
CREATE POLICY "referrals_update" ON referrals
  FOR UPDATE USING (auth.uid() IS NOT NULL);

COMMIT;
