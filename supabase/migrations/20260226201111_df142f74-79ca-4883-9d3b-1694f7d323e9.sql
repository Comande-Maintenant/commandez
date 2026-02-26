
-- Allow inserting menu items (admin adding products)
CREATE POLICY "Anyone can insert menu items"
  ON public.menu_items FOR INSERT WITH CHECK (true);

-- Allow updating menu items
CREATE POLICY "Anyone can update menu items"
  ON public.menu_items FOR UPDATE USING (true);

-- Allow deleting menu items
CREATE POLICY "Anyone can delete menu items"
  ON public.menu_items FOR DELETE USING (true);

-- Allow inserting restaurant hours
CREATE POLICY "Anyone can insert restaurant hours"
  ON public.restaurant_hours FOR INSERT WITH CHECK (true);

-- Allow updating restaurants (for toggling is_accepting_orders)
CREATE POLICY "Anyone can update restaurants"
  ON public.restaurants FOR UPDATE USING (true);
