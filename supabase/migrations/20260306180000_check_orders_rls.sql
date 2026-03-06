-- Diagnostic: ensure orders INSERT policy exists for anon
-- Drop any restrictive policies that might block inserts
DROP POLICY IF EXISTS "orders_insert_restricted" ON orders;

-- Recreate permissive INSERT policy
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (true);
