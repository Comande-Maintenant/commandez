-- ============================================================
-- 022: Fix remaining security gaps
--
-- 1. daily_order_counters: make trigger SECURITY DEFINER, lock table
-- 2. menu-item-images storage: add auth + owner check (was anon-writable)
-- 3. restaurant-images storage: add owner check (was any-auth-writable)
-- 4. referrals UPDATE: restrict to involved parties
-- ============================================================

BEGIN;

-- ==========================================
-- 1. DAILY_ORDER_COUNTERS
-- The trigger set_daily_order_number does INSERT...ON CONFLICT UPDATE
-- on this table. Making it SECURITY DEFINER means it bypasses RLS,
-- so we can lock down the table completely.
-- ==========================================

-- Recreate the trigger function as SECURITY DEFINER
CREATE OR REPLACE FUNCTION set_daily_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Drop all wide-open policies
DROP POLICY IF EXISTS "Anon can insert daily_order_counters" ON daily_order_counters;
DROP POLICY IF EXISTS "Authenticated users can insert daily_order_counters" ON daily_order_counters;
DROP POLICY IF EXISTS "Anon can read daily_order_counters" ON daily_order_counters;
DROP POLICY IF EXISTS "Authenticated users can read daily_order_counters" ON daily_order_counters;
DROP POLICY IF EXISTS "Anon can update daily_order_counters" ON daily_order_counters;
DROP POLICY IF EXISTS "Authenticated users can update daily_order_counters" ON daily_order_counters;

-- SELECT: restaurant owner only (for admin dashboard)
CREATE POLICY "daily_order_counters_select" ON daily_order_counters
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- No INSERT/UPDATE/DELETE policies: only the SECURITY DEFINER trigger writes here

-- ==========================================
-- 2. STORAGE: menu-item-images
-- Path pattern: {restaurantId}/{menuItemId}.webp
-- Was: anon could INSERT/UPDATE/DELETE (no auth check!)
-- Fix: auth required + owner check via path
-- ==========================================

DROP POLICY IF EXISTS "Auth upload menu-item-images" ON storage.objects;
DROP POLICY IF EXISTS "Auth update menu-item-images" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete menu-item-images" ON storage.objects;
-- Keep public read
-- DROP POLICY IF EXISTS "Public read menu-item-images" ON storage.objects;

CREATE POLICY "menu_item_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menu-item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "menu_item_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'menu-item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "menu_item_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'menu-item-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- ==========================================
-- 3. STORAGE: restaurant-images
-- Path pattern: {restaurantId}/{type}.{ext}
-- Was: any authenticated user could modify any restaurant's images
-- Fix: owner check via path
-- ==========================================

DROP POLICY IF EXISTS "restaurant_images_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_images_auth_delete" ON storage.objects;
-- Keep public read
-- DROP POLICY IF EXISTS "restaurant_images_public_read" ON storage.objects;

CREATE POLICY "restaurant_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'restaurant-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "restaurant_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'restaurant-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "restaurant_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'restaurant-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- ==========================================
-- 4. REFERRALS UPDATE: restrict to involved parties
-- Was: any authenticated user could update any referral
-- Fix: only referrer owner or referee owner
-- ==========================================

DROP POLICY IF EXISTS "referrals_update" ON referrals;

CREATE POLICY "referrals_update" ON referrals
  FOR UPDATE USING (
    referrer_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    OR referee_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

COMMIT;
