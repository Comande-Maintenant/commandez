-- Migration: Assiette configurator for demo restaurant
-- Adds group column to restaurant_bases, supplement step template,
-- and sets up demo data for the composable assiette flow

-- 1. Add group column to restaurant_bases (sandwich vs assiette)
ALTER TABLE restaurant_bases ADD COLUMN IF NOT EXISTS "group" text DEFAULT NULL;

-- 2. Add supplement step template for kebab cuisine (between sauce and accompagnement)
INSERT INTO cuisine_step_templates (cuisine_type, step_key, step_type, label_i18n, data_source, sort_order, required, config)
VALUES ('kebab', 'supplement', 'multi_select', 'custom.choose_supplements', 'menu_items_filter', 4.5, false, '{"filter_field": "product_type", "filter_value": "supplement"}')
ON CONFLICT DO NOTHING;

-- Fix sort_order to be integer-friendly: reorder steps
UPDATE cuisine_step_templates SET sort_order = 5 WHERE cuisine_type = 'kebab' AND step_key = 'supplement';
UPDATE cuisine_step_templates SET sort_order = 6 WHERE cuisine_type = 'kebab' AND step_key = 'accompagnement';
UPDATE cuisine_step_templates SET sort_order = 7 WHERE cuisine_type = 'kebab' AND step_key = 'boisson';
UPDATE cuisine_step_templates SET sort_order = 8 WHERE cuisine_type = 'kebab' AND step_key = 'dessert';
UPDATE cuisine_step_templates SET sort_order = 9 WHERE cuisine_type = 'kebab' AND step_key = 'recap';

-- ============================================================
-- 3. Demo restaurant data (id: 81079f24-9e36-4c5b-b874-3eee6aa849d5)
-- ============================================================
DO $$
DECLARE
  demo_id uuid := '81079f24-9e36-4c5b-b874-3eee6aa849d5';
BEGIN

  -- 3a. Disable old hardcoded assiette items
  UPDATE menu_items SET enabled = false
  WHERE restaurant_id = demo_id AND category = 'ASSIETTES' AND product_type = 'simple';

  -- 3b. Insert single configurable "Assiette" item
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, popular, sort_order)
  VALUES (demo_id, 'Assiette composee', 'Choisissez votre taille, vos viandes, sauces et accompagnement', 0, 'ASSIETTES', 'assiette', true, true, 1)
  ON CONFLICT DO NOTHING;

  -- 3c. Bases (tailles) for assiettes
  INSERT INTO restaurant_bases (restaurant_id, name, name_translations, price, max_viandes, "group", sort_order, enabled) VALUES
    (demo_id, 'Petite assiette', '{"en":"Small plate","es":"Plato pequeno","de":"Kleiner Teller"}', 8.00, 1, 'assiette', 1, true),
    (demo_id, 'Grande assiette', '{"en":"Large plate","es":"Plato grande","de":"Grosser Teller"}', 11.00, 3, 'assiette', 2, true);

  -- 3d. Viandes
  INSERT INTO restaurant_viandes (restaurant_id, name, name_translations, supplement, sort_order, enabled) VALUES
    (demo_id, 'Kebab', '{"en":"Kebab","es":"Kebab","de":"Kebab"}', 0, 1, true),
    (demo_id, 'Poulet', '{"en":"Chicken","es":"Pollo","de":"Huhn"}', 0, 2, true),
    (demo_id, 'Merguez', '{"en":"Merguez","es":"Merguez","de":"Merguez"}', 0, 3, true),
    (demo_id, 'Kefta', '{"en":"Kefta","es":"Kefta","de":"Kefta"}', 0, 4, true),
    (demo_id, 'Steak', '{"en":"Steak","es":"Filete","de":"Steak"}', 1.50, 5, true),
    (demo_id, 'Chicken tikka', '{"en":"Chicken tikka","es":"Chicken tikka","de":"Chicken tikka"}', 0.50, 6, true),
    (demo_id, 'Poulet creme', '{"en":"Cream chicken","es":"Pollo crema","de":"Sahnehuhn"}', 0.50, 7, true),
    (demo_id, 'Kofte', '{"en":"Kofte","es":"Kofte","de":"Kofte"}', 0.50, 8, true);

  -- 3e. Sauces
  INSERT INTO restaurant_sauces (restaurant_id, name, name_translations, is_for_sandwich, is_for_frites, sort_order, enabled) VALUES
    (demo_id, 'Algerienne', '{"en":"Algerian","es":"Argelina","de":"Algerische"}', true, true, 1, true),
    (demo_id, 'Blanche', '{"en":"White sauce","es":"Salsa blanca","de":"Weisse Sosse"}', true, true, 2, true),
    (demo_id, 'Samourai', '{"en":"Samurai","es":"Samurai","de":"Samurai"}', true, true, 3, true),
    (demo_id, 'Ketchup', '{"en":"Ketchup","es":"Ketchup","de":"Ketchup"}', true, true, 4, true),
    (demo_id, 'Harissa', '{"en":"Harissa","es":"Harissa","de":"Harissa"}', true, true, 5, true),
    (demo_id, 'Mayonnaise', '{"en":"Mayonnaise","es":"Mayonesa","de":"Mayonnaise"}', true, true, 6, true),
    (demo_id, 'Barbecue', '{"en":"BBQ","es":"Barbacoa","de":"BBQ"}', true, true, 7, true);

  -- 3f. Accompagnements
  INSERT INTO restaurant_accompagnements (restaurant_id, name, name_translations, has_sizes, price_default, has_sauce_option, sort_order, enabled) VALUES
    (demo_id, 'Frites', '{"en":"Fries","es":"Patatas fritas","de":"Pommes"}', false, 0, true, 1, true),
    (demo_id, 'Ble', '{"en":"Wheat","es":"Trigo","de":"Weizen"}', false, 0, false, 2, true);

  -- 3g. Supplement items (product_type = supplement)
  INSERT INTO menu_items (restaurant_id, name, description, price, category, product_type, enabled, sort_order) VALUES
    (demo_id, 'Fromage', 'Supplement fromage', 1.00, 'ASSIETTES', 'supplement', true, 90),
    (demo_id, 'Oeuf', 'Supplement oeuf', 1.00, 'ASSIETTES', 'supplement', true, 91)
  ON CONFLICT DO NOTHING;

  -- 3h. Order config
  INSERT INTO restaurant_order_config (restaurant_id, free_sauces_sandwich, free_sauces_frites, extra_sauce_price, suggest_sauce_from_sandwich, enable_boisson_upsell, enable_dessert_upsell)
  VALUES (demo_id, 3, 2, 0.50, true, false, false)
  ON CONFLICT (restaurant_id) DO UPDATE SET
    free_sauces_sandwich = EXCLUDED.free_sauces_sandwich,
    free_sauces_frites = EXCLUDED.free_sauces_frites;

END $$;
