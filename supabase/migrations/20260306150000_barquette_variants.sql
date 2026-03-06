-- Migration: Add size variants to barquette items for Antalya Kebab demo
-- Also adds Hamburger Double Steak as configurable item

DO $$
DECLARE
  rid uuid := '769f54f9-09a6-40a9-a490-26597a717646';
BEGIN

  -- Disable old flat-price barquette items
  UPDATE menu_items SET enabled = false
  WHERE restaurant_id = rid AND name IN ('Barquette Viande', 'Barquette Frites', 'Barquette de Viande + Frites')
    AND product_type = 'simple';

  -- Barquette Viande with size variants
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order, variants)
  VALUES (rid, 'Barquette Viande', '', 5.00, 'DIVERS', 'simple', true, 28,
    '[{"name":"Petite","price":5},{"name":"Moyenne","price":7},{"name":"Grande","price":9},{"name":"Longue","price":12}]'::jsonb)
  ON CONFLICT DO NOTHING;

  -- Barquette Frites with size variants
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order, variants)
  VALUES (rid, 'Barquette Frites', '', 3.00, 'DIVERS', 'simple', true, 29,
    '[{"name":"Petite","price":3},{"name":"Moyenne","price":3.5},{"name":"Grande","price":4},{"name":"Longue","price":5}]'::jsonb)
  ON CONFLICT DO NOTHING;

  -- Barquette Viande + Frites with size variants
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order, variants)
  VALUES (rid, 'Barquette Viande + Frites', '', 5.00, 'DIVERS', 'simple', true, 30,
    '[{"name":"Petite","price":5},{"name":"Moyenne","price":6},{"name":"Grande","price":7},{"name":"Longue","price":8}]'::jsonb)
  ON CONFLICT DO NOTHING;

  -- Disable old Hamburger Double Steak (simple)
  UPDATE menu_items SET enabled = false
  WHERE restaurant_id = rid AND name = 'Hamburger Double Steak' AND product_type = 'simple';

  -- Add Hamburger Double Steak as configurable hamburger
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order)
  VALUES (rid, 'Hamburger Double Steak', 'Pain burger, double steak, crudites, sauce', 8.00, 'SANDWICHS', 'hamburger', true, 5)
  ON CONFLICT DO NOTHING;

END $$;
