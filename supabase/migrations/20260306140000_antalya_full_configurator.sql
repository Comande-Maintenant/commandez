-- Migration: Full configurator setup for Antalya Kebab demo restaurant
-- Restructures menu from individual variants to configurable product categories
-- Adds frites step template, bases, viandes, garnitures, sauces, accompagnements, supplements

-- ============================================================
-- 1. Add "frites" step template for kebab cuisine
-- ============================================================
INSERT INTO cuisine_step_templates (cuisine_type, step_key, step_type, label_i18n, data_source, sort_order, required, config)
VALUES (
  'kebab',
  'frites',
  'single_select',
  'custom.frites_option',
  'none',
  4.5,
  false,
  '{"options": [{"id": "sans_frites", "name": "Sans frites", "price": 0}, {"id": "avec_frites", "name": "Avec frites +1\u20ac", "price": 1}]}'
)
ON CONFLICT DO NOTHING;

-- Add extra_viande_price to viande step (for tacos/assiettes: +2 per extra viande)
UPDATE cuisine_step_templates
SET config = config || '{"extra_viande_price": 2}'::jsonb
WHERE cuisine_type = 'kebab' AND step_key = 'viande';

-- Reorder steps to keep clean integer ordering
UPDATE cuisine_step_templates SET sort_order = 5 WHERE cuisine_type = 'kebab' AND step_key = 'frites';
UPDATE cuisine_step_templates SET sort_order = 6 WHERE cuisine_type = 'kebab' AND step_key = 'supplement';
UPDATE cuisine_step_templates SET sort_order = 7 WHERE cuisine_type = 'kebab' AND step_key = 'accompagnement';
UPDATE cuisine_step_templates SET sort_order = 8 WHERE cuisine_type = 'kebab' AND step_key = 'boisson';
UPDATE cuisine_step_templates SET sort_order = 9 WHERE cuisine_type = 'kebab' AND step_key = 'dessert';
UPDATE cuisine_step_templates SET sort_order = 10 WHERE cuisine_type = 'kebab' AND step_key = 'recap';

-- ============================================================
-- 2. Antalya Kebab demo restaurant data
-- ============================================================
DO $$
DECLARE
  rid uuid := '769f54f9-09a6-40a9-a490-26597a717646';
BEGIN

  -- --------------------------------------------------------
  -- 2a. Disable old individual sandwich/tacos/galette/hamburger/assiette items
  -- --------------------------------------------------------
  -- Sandwichs: disable individual variants (Kebab, Panini, Sandwich X, Galette, Hamburger, Tacos...)
  UPDATE menu_items SET enabled = false
  WHERE restaurant_id = rid AND category = 'SANDWICHS' AND product_type = 'simple';

  -- Assiettes: disable individual variants
  UPDATE menu_items SET enabled = false
  WHERE restaurant_id = rid AND category = 'ASSIETTES' AND product_type = 'simple';

  -- --------------------------------------------------------
  -- 2b. Create new configurable menu items
  -- --------------------------------------------------------

  -- Kebab (opens sandwich configurator with Kebab pre-selected)
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, popular, sort_order)
  VALUES (rid, 'Kebab', 'Pain, viande kebab, crudites, sauce', 6.50, 'SANDWICHS', 'sandwich', true, true, 0)
  ON CONFLICT DO NOTHING;

  -- Sandwich (generic, user picks viande)
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, popular, sort_order)
  VALUES (rid, 'Sandwich', 'Pain, viande au choix, crudites, sauce', 7.00, 'SANDWICHS', 'sandwich', true, false, 1)
  ON CONFLICT DO NOTHING;

  -- Galette
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, popular, sort_order)
  VALUES (rid, 'Galette', 'Galette garnie, viande au choix, crudites, sauce', 0, 'SANDWICHS', 'galette', true, false, 2)
  ON CONFLICT DO NOTHING;

  -- Tacos
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, popular, sort_order)
  VALUES (rid, 'Tacos', 'Tacos garni, viande(s) au choix, fromage, sauce', 0, 'SANDWICHS', 'tacos', true, true, 3)
  ON CONFLICT DO NOTHING;

  -- Hamburger
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, popular, sort_order)
  VALUES (rid, 'Hamburger', 'Pain burger, steak, crudites, sauce', 5.50, 'SANDWICHS', 'hamburger', true, false, 4)
  ON CONFLICT DO NOTHING;

  -- Panini (simple item, no configurator)
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order)
  VALUES (rid, 'Panini 3 fromages', '', 5.50, 'SANDWICHS', 'simple', true, 5)
  ON CONFLICT DO NOTHING;

  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order)
  VALUES (rid, 'Panini Poulet fromage', '', 5.50, 'SANDWICHS', 'simple', true, 6)
  ON CONFLICT DO NOTHING;

  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order)
  VALUES (rid, 'Panini Nutella / Speculos', '', 4.00, 'SANDWICHS', 'simple', true, 7)
  ON CONFLICT DO NOTHING;

  -- Assiette (configurable)
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, popular, sort_order)
  VALUES (rid, 'Assiette', 'Choisissez la taille, viande(s), sauce et accompagnement', 0, 'ASSIETTES', 'assiette', true, true, 0)
  ON CONFLICT DO NOTHING;

  -- Supplements (hidden from menu, shown in configurator)
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order)
  VALUES
    (rid, 'Fromage', 'Supplement fromage', 1.00, 'SUPPLEMENTS', 'supplement', true, 90),
    (rid, 'Oeuf', 'Supplement oeuf', 1.00, 'SUPPLEMENTS', 'supplement', true, 91)
  ON CONFLICT DO NOTHING;

  -- Set boisson items product_type for upsell
  UPDATE menu_items SET product_type = 'boisson' WHERE restaurant_id = rid AND category = 'BOISSONS';
  UPDATE menu_items SET product_type = 'dessert' WHERE restaurant_id = rid AND category = 'DESSERTS';

  -- --------------------------------------------------------
  -- 2c. Bases (tailles) - grouped by product type
  -- --------------------------------------------------------
  -- Galettes
  INSERT INTO restaurant_bases (restaurant_id, name, name_translations, price, max_viandes, "group", sort_order, enabled) VALUES
    (rid, 'Galette', '{"en":"Galette","es":"Galette","de":"Galette"}', 7.00, 1, 'galette', 1, true),
    (rid, 'Galette Geante', '{"en":"Giant Galette","es":"Galette Gigante","de":"Riesen-Galette"}', 10.00, 1, 'galette', 2, true);

  -- Tacos
  INSERT INTO restaurant_bases (restaurant_id, name, name_translations, price, max_viandes, "group", sort_order, enabled) VALUES
    (rid, 'Tacos Normal', '{"en":"Regular Tacos","es":"Tacos Normal","de":"Normaler Tacos"}', 8.00, 3, 'tacos', 3, true),
    (rid, 'Tacos Geant', '{"en":"Giant Tacos","es":"Tacos Gigante","de":"Riesen-Tacos"}', 13.00, 3, 'tacos', 4, true);

  -- Assiettes
  INSERT INTO restaurant_bases (restaurant_id, name, name_translations, price, max_viandes, "group", sort_order, enabled) VALUES
    (rid, 'Petite assiette', '{"en":"Small plate","es":"Plato pequeno","de":"Kleiner Teller"}', 8.00, 1, 'assiette', 5, true),
    (rid, 'Grande assiette', '{"en":"Large plate","es":"Plato grande","de":"Grosser Teller"}', 11.00, 3, 'assiette', 6, true);

  -- --------------------------------------------------------
  -- 2d. Viandes (shared across all configurable products)
  -- --------------------------------------------------------
  INSERT INTO restaurant_viandes (restaurant_id, name, name_translations, supplement, sort_order, enabled) VALUES
    (rid, 'Kebab', '{"en":"Kebab","es":"Kebab","de":"Kebab"}', 0, 1, true),
    (rid, 'Poulet', '{"en":"Chicken","es":"Pollo","de":"Huhn"}', 0, 2, true),
    (rid, 'Merguez', '{"en":"Merguez","es":"Merguez","de":"Merguez"}', 0, 3, true),
    (rid, 'Kefta', '{"en":"Kefta","es":"Kefta","de":"Kefta"}', 0, 4, true),
    (rid, 'Steak', '{"en":"Steak","es":"Filete","de":"Steak"}', 0, 5, true),
    (rid, 'Chicken tikka', '{"en":"Chicken tikka","es":"Chicken tikka","de":"Chicken tikka"}', 0, 6, true),
    (rid, 'Poulet creme', '{"en":"Cream chicken","es":"Pollo crema","de":"Sahnehuhn"}', 0, 7, true),
    (rid, 'Kofte', '{"en":"Kofte","es":"Kofte","de":"Kofte"}', 0, 8, true);

  -- --------------------------------------------------------
  -- 2e. Garnitures (crudites)
  -- --------------------------------------------------------
  INSERT INTO restaurant_garnitures (restaurant_id, name, name_translations, is_default, price_x2, sort_order, enabled) VALUES
    (rid, 'Salade', '{"en":"Lettuce","es":"Lechuga","de":"Salat"}', true, 0, 1, true),
    (rid, 'Tomates', '{"en":"Tomatoes","es":"Tomates","de":"Tomaten"}', true, 0, 2, true),
    (rid, 'Oignons', '{"en":"Onions","es":"Cebollas","de":"Zwiebeln"}', true, 0, 3, true);

  -- --------------------------------------------------------
  -- 2f. Sauces
  -- --------------------------------------------------------
  INSERT INTO restaurant_sauces (restaurant_id, name, name_translations, is_for_sandwich, is_for_frites, sort_order, enabled) VALUES
    (rid, 'Algerienne', '{"en":"Algerian","es":"Argelina","de":"Algerische"}', true, true, 1, true),
    (rid, 'Blanche', '{"en":"White sauce","es":"Salsa blanca","de":"Weisse Sosse"}', true, true, 2, true),
    (rid, 'Samourai', '{"en":"Samurai","es":"Samurai","de":"Samurai"}', true, true, 3, true),
    (rid, 'Ketchup', '{"en":"Ketchup","es":"Ketchup","de":"Ketchup"}', true, true, 4, true),
    (rid, 'Harissa', '{"en":"Harissa","es":"Harissa","de":"Harissa"}', true, true, 5, true),
    (rid, 'Mayonnaise', '{"en":"Mayonnaise","es":"Mayonesa","de":"Mayonnaise"}', true, true, 6, true),
    (rid, 'Barbecue', '{"en":"BBQ","es":"Barbacoa","de":"BBQ"}', true, true, 7, true);

  -- --------------------------------------------------------
  -- 2g. Accompagnements (for assiettes)
  -- --------------------------------------------------------
  INSERT INTO restaurant_accompagnements (restaurant_id, name, name_translations, has_sizes, price_default, has_sauce_option, sort_order, enabled) VALUES
    (rid, 'Frites', '{"en":"Fries","es":"Patatas fritas","de":"Pommes"}', false, 0, true, 1, true),
    (rid, 'Ble', '{"en":"Wheat","es":"Trigo","de":"Weizen"}', false, 0, false, 2, true);

  -- --------------------------------------------------------
  -- 2h. Order config
  -- --------------------------------------------------------
  INSERT INTO restaurant_order_config (restaurant_id, free_sauces_sandwich, free_sauces_frites, extra_sauce_price, suggest_sauce_from_sandwich, enable_boisson_upsell, enable_dessert_upsell)
  VALUES (rid, 3, 2, 0.50, true, false, false)
  ON CONFLICT (restaurant_id) DO UPDATE SET
    free_sauces_sandwich = EXCLUDED.free_sauces_sandwich,
    free_sauces_frites = EXCLUDED.free_sauces_frites,
    extra_sauce_price = EXCLUDED.extra_sauce_price;

END $$;
