-- Tighten RLS policies for production security
-- Keep SELECT public where needed, restrict writes to owners

-- restaurants: public read, owner-only write
DROP POLICY IF EXISTS "restaurants_select" ON restaurants;
DROP POLICY IF EXISTS "restaurants_insert" ON restaurants;
DROP POLICY IF EXISTS "restaurants_update" ON restaurants;
DROP POLICY IF EXISTS "restaurants_delete" ON restaurants;
DROP POLICY IF EXISTS "Allow public read access" ON restaurants;
DROP POLICY IF EXISTS "Allow authenticated insert" ON restaurants;
DROP POLICY IF EXISTS "Allow owner update" ON restaurants;

CREATE POLICY "restaurants_select" ON restaurants FOR SELECT USING (true);
CREATE POLICY "restaurants_insert" ON restaurants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "restaurants_update" ON restaurants FOR UPDATE USING (
  auth.uid() = owner_id
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "restaurants_delete" ON restaurants FOR DELETE USING (
  auth.uid() = owner_id
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);

-- menu_items: public read, owner-only write
DROP POLICY IF EXISTS "menu_items_select" ON menu_items;
DROP POLICY IF EXISTS "menu_items_insert" ON menu_items;
DROP POLICY IF EXISTS "menu_items_update" ON menu_items;
DROP POLICY IF EXISTS "menu_items_delete" ON menu_items;
DROP POLICY IF EXISTS "Allow public read" ON menu_items;
DROP POLICY IF EXISTS "Allow insert" ON menu_items;
DROP POLICY IF EXISTS "Allow update" ON menu_items;
DROP POLICY IF EXISTS "Allow delete" ON menu_items;

CREATE POLICY "menu_items_select" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_insert" ON menu_items FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "menu_items_update" ON menu_items FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "menu_items_delete" ON menu_items FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);

-- orders: public read + insert (clients place orders), owner-only update
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "Allow public read" ON orders;
DROP POLICY IF EXISTS "Allow insert" ON orders;
DROP POLICY IF EXISTS "Allow update" ON orders;

CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);

-- restaurant_hours: public read, owner-only write
DROP POLICY IF EXISTS "restaurant_hours_select" ON restaurant_hours;
DROP POLICY IF EXISTS "restaurant_hours_insert" ON restaurant_hours;
DROP POLICY IF EXISTS "restaurant_hours_update" ON restaurant_hours;
DROP POLICY IF EXISTS "Allow public read" ON restaurant_hours;
DROP POLICY IF EXISTS "Allow insert" ON restaurant_hours;
DROP POLICY IF EXISTS "Allow update" ON restaurant_hours;

CREATE POLICY "restaurant_hours_select" ON restaurant_hours FOR SELECT USING (true);
CREATE POLICY "restaurant_hours_insert" ON restaurant_hours FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "restaurant_hours_update" ON restaurant_hours FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);

-- restaurant_tablets: owner-only everything
DROP POLICY IF EXISTS "restaurant_tablets_select" ON restaurant_tablets;
DROP POLICY IF EXISTS "restaurant_tablets_insert" ON restaurant_tablets;
DROP POLICY IF EXISTS "restaurant_tablets_update" ON restaurant_tablets;
DROP POLICY IF EXISTS "restaurant_tablets_delete" ON restaurant_tablets;
DROP POLICY IF EXISTS "Allow public read" ON restaurant_tablets;
DROP POLICY IF EXISTS "Allow insert" ON restaurant_tablets;
DROP POLICY IF EXISTS "Allow update" ON restaurant_tablets;
DROP POLICY IF EXISTS "Allow delete" ON restaurant_tablets;

CREATE POLICY "restaurant_tablets_select" ON restaurant_tablets FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "restaurant_tablets_insert" ON restaurant_tablets FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "restaurant_tablets_update" ON restaurant_tablets FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "restaurant_tablets_delete" ON restaurant_tablets FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);

-- restaurant_customers: owner-only everything
DROP POLICY IF EXISTS "restaurant_customers_select" ON restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_insert" ON restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_update" ON restaurant_customers;

CREATE POLICY "restaurant_customers_select_owner" ON restaurant_customers FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "restaurant_customers_insert_owner" ON restaurant_customers FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "restaurant_customers_update_owner" ON restaurant_customers FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
  OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
);
