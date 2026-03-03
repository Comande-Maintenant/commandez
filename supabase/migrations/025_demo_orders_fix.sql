-- 025_demo_orders_fix.sql
-- Fix: allow anonymous users to read demo orders (needed for .insert().select() and tracking)
-- + Enrich demo menu items with sauces, garnitures, supplements

-- 1. Allow anon SELECT on demo restaurant orders
CREATE POLICY orders_select_demo ON orders FOR SELECT TO anon
USING (restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true));

-- 2. Add sauces to sandwichs and assiettes (demo restaurant)
UPDATE menu_items SET sauces = ARRAY[
  'Blanche', 'Ketchup', 'Mayonnaise', 'Algérienne', 'Samourai',
  'Harissa', 'Barbecue', 'Curry', 'Andalouse', 'Biggy'
]
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true)
  AND category IN ('Sandwichs', 'ASSIETTES');

-- 3. Add supplements (fromage, frites, boisson) to sandwichs
UPDATE menu_items SET supplements = '[
  {"id": "fromage", "name": "Fromage", "price": 1.00},
  {"id": "frites", "name": "Frites", "price": 2.00},
  {"id": "boisson", "name": "Boisson", "price": 1.50}
]'::jsonb
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true)
  AND category = 'Sandwichs';

-- 4. Add supplements (fromage, supplement viande) to assiettes
UPDATE menu_items SET supplements = '[
  {"id": "fromage", "name": "Fromage", "price": 1.00},
  {"id": "sup-viande", "name": "Supplément viande", "price": 2.50}
]'::jsonb
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true)
  AND category = 'ASSIETTES';

-- 5. Set empty arrays for items that had NULL (boissons, desserts, divers)
UPDATE menu_items SET
  sauces = ARRAY[]::text[],
  supplements = '[]'::jsonb
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE is_demo = true)
  AND sauces IS NULL;
