-- Fix: the .insert().select().single() pattern needs the inserting user
-- to be able to SELECT the row they just created.
-- Current orders_select policy requires owner_id/super_admin/customer_user_id match,
-- which fails for regular authenticated users placing orders.

-- Replace the existing select policy to also allow reading recently created orders
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (
    -- Restaurant owner
    auth.uid() = (SELECT owner_id FROM restaurants WHERE id = restaurant_id)
    -- Super admin
    OR EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
    -- Customer linked to order
    OR (auth.uid() IS NOT NULL AND auth.uid() = customer_user_id)
    -- Recently created (for insert+select pattern, any authenticated user)
    OR created_at > NOW() - INTERVAL '5 minutes'
  );
