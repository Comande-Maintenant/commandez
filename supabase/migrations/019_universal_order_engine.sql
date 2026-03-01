-- ============================================================
-- 019: Universal Order Engine
-- Adds cuisine_type to restaurants + cuisine_step_templates table
-- ============================================================

-- 1. Add cuisine_type column to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cuisine_type TEXT NOT NULL DEFAULT 'generic';

-- Set known kebab restaurants
UPDATE restaurants SET cuisine_type = 'kebab'
  WHERE id IN ('c236aa92-cab3-4aa1-a337-7767770cb764', 'd1e2f3a4-b5c6-7890-abcd-ef1234567890');

-- 2. Create cuisine_step_templates table
CREATE TABLE IF NOT EXISTS cuisine_step_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuisine_type TEXT NOT NULL,
  step_key TEXT NOT NULL,
  label_i18n TEXT NOT NULL,
  data_source TEXT NOT NULL,
  step_type TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cuisine_type, step_key)
);

-- RLS
ALTER TABLE cuisine_step_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuisine_step_templates_select" ON cuisine_step_templates
  FOR SELECT USING (true);

CREATE POLICY "cuisine_step_templates_admin" ON cuisine_step_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM owners WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_cst_cuisine_type ON cuisine_step_templates(cuisine_type);

-- ============================================================
-- 3. Seeds: 12 cuisine types
-- ============================================================

-- KEBAB (reproduces exact current hardcoded behavior)
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('kebab', 'base', 'custom.choose_base', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('kebab', 'viande', 'custom.choose_meat', 'restaurant_viandes', 'multi_select', 2, true, '{"max_from_base": true}'),
  ('kebab', 'garniture', 'custom.toppings', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('kebab', 'sauce', 'custom.sauces', 'restaurant_sauces', 'chip_select', 4, false, '{"filter_field": "is_for_sandwich", "free_count_config": "free_sauces_sandwich"}'),
  ('kebab', 'accompagnement', 'custom.side', 'restaurant_accompagnements', 'single_select', 5, false, '{"enable_config": "enable_accompagnement"}'),
  ('kebab', 'boisson', 'custom.drink_upsell', 'menu_items_filter', 'upsell', 6, false, '{"filter_field": "product_type", "filter_value": "boisson", "enable_config": "enable_boisson_upsell"}'),
  ('kebab', 'dessert', 'custom.dessert_upsell', 'menu_items_filter', 'upsell', 7, false, '{"filter_field": "product_type", "filter_value": "dessert", "enable_config": "enable_dessert_upsell"}'),
  ('kebab', 'recap', 'custom.recap', 'none', 'recap', 8, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- PIZZA
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('pizza', 'base', 'custom.choose_size', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('pizza', 'garniture', 'custom.choose_toppings', 'restaurant_garnitures', 'toggle_group', 2, false, '{}'),
  ('pizza', 'sauce', 'custom.choose_sauce', 'restaurant_sauces', 'chip_select', 3, false, '{"filter_field": "is_for_sandwich"}'),
  ('pizza', 'boisson', 'custom.drink_upsell', 'menu_items_filter', 'upsell', 4, false, '{"filter_field": "product_type", "filter_value": "boisson", "enable_config": "enable_boisson_upsell"}'),
  ('pizza', 'dessert', 'custom.dessert_upsell', 'menu_items_filter', 'upsell', 5, false, '{"filter_field": "product_type", "filter_value": "dessert", "enable_config": "enable_dessert_upsell"}'),
  ('pizza', 'recap', 'custom.recap', 'none', 'recap', 6, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- BURGER
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('burger', 'base', 'custom.choose_bread', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('burger', 'viande', 'custom.choose_protein', 'restaurant_viandes', 'multi_select', 2, true, '{"max_from_base": true}'),
  ('burger', 'garniture', 'custom.toppings', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('burger', 'sauce', 'custom.sauces', 'restaurant_sauces', 'chip_select', 4, false, '{"filter_field": "is_for_sandwich", "free_count_config": "free_sauces_sandwich"}'),
  ('burger', 'accompagnement', 'custom.side', 'restaurant_accompagnements', 'single_select', 5, false, '{}'),
  ('burger', 'boisson', 'custom.drink_upsell', 'menu_items_filter', 'upsell', 6, false, '{"filter_field": "product_type", "filter_value": "boisson", "enable_config": "enable_boisson_upsell"}'),
  ('burger', 'recap', 'custom.recap', 'none', 'recap', 7, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- SUSHI
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('sushi', 'base', 'custom.choose_formula', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('sushi', 'viande', 'custom.choose_pieces', 'restaurant_viandes', 'multi_select', 2, false, '{}'),
  ('sushi', 'sauce', 'custom.choose_sauce', 'restaurant_sauces', 'chip_select', 3, false, '{}'),
  ('sushi', 'boisson', 'custom.drink_upsell', 'menu_items_filter', 'upsell', 4, false, '{"filter_field": "product_type", "filter_value": "boisson", "enable_config": "enable_boisson_upsell"}'),
  ('sushi', 'recap', 'custom.recap', 'none', 'recap', 5, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- INDIAN
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('indian', 'base', 'custom.choose_base', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('indian', 'viande', 'custom.choose_protein', 'restaurant_viandes', 'multi_select', 2, true, '{}'),
  ('indian', 'garniture', 'custom.extras', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('indian', 'sauce', 'custom.spice_level', 'restaurant_sauces', 'chip_select', 4, false, '{}'),
  ('indian', 'accompagnement', 'custom.side', 'restaurant_accompagnements', 'single_select', 5, false, '{}'),
  ('indian', 'recap', 'custom.recap', 'none', 'recap', 6, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- CHINESE
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('chinese', 'base', 'custom.choose_base', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('chinese', 'viande', 'custom.choose_protein', 'restaurant_viandes', 'multi_select', 2, true, '{}'),
  ('chinese', 'sauce', 'custom.choose_sauce', 'restaurant_sauces', 'chip_select', 3, false, '{}'),
  ('chinese', 'accompagnement', 'custom.side', 'restaurant_accompagnements', 'single_select', 4, false, '{}'),
  ('chinese', 'boisson', 'custom.drink_upsell', 'menu_items_filter', 'upsell', 5, false, '{"filter_field": "product_type", "filter_value": "boisson", "enable_config": "enable_boisson_upsell"}'),
  ('chinese', 'recap', 'custom.recap', 'none', 'recap', 6, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- BAKERY
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('bakery', 'base', 'custom.choose_bread', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('bakery', 'viande', 'custom.choose_filling', 'restaurant_viandes', 'multi_select', 2, false, '{}'),
  ('bakery', 'garniture', 'custom.extras', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('bakery', 'sauce', 'custom.sauces', 'restaurant_sauces', 'chip_select', 4, false, '{}'),
  ('bakery', 'recap', 'custom.recap', 'none', 'recap', 5, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- POKE
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('poke', 'base', 'custom.choose_base', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('poke', 'viande', 'custom.choose_protein', 'restaurant_viandes', 'multi_select', 2, true, '{}'),
  ('poke', 'garniture', 'custom.choose_toppings', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('poke', 'sauce', 'custom.choose_sauce', 'restaurant_sauces', 'chip_select', 4, false, '{}'),
  ('poke', 'accompagnement', 'custom.side', 'restaurant_accompagnements', 'single_select', 5, false, '{}'),
  ('poke', 'recap', 'custom.recap', 'none', 'recap', 6, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- CREPERIE
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('creperie', 'base', 'custom.choose_base', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('creperie', 'viande', 'custom.choose_filling', 'restaurant_viandes', 'multi_select', 2, false, '{}'),
  ('creperie', 'garniture', 'custom.extras', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('creperie', 'sauce', 'custom.sauces', 'restaurant_sauces', 'chip_select', 4, false, '{}'),
  ('creperie', 'dessert', 'custom.dessert_upsell', 'menu_items_filter', 'upsell', 5, false, '{"filter_field": "product_type", "filter_value": "dessert", "enable_config": "enable_dessert_upsell"}'),
  ('creperie', 'recap', 'custom.recap', 'none', 'recap', 6, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- COFFEE SHOP
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('coffee_shop', 'base', 'custom.choose_size', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('coffee_shop', 'viande', 'custom.choose_type', 'restaurant_viandes', 'single_select', 2, true, '{}'),
  ('coffee_shop', 'garniture', 'custom.extras', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('coffee_shop', 'recap', 'custom.recap', 'none', 'recap', 4, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- TACOS FR
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('tacos_fr', 'base', 'custom.choose_size', 'restaurant_bases', 'single_select', 1, true, '{}'),
  ('tacos_fr', 'viande', 'custom.choose_meat', 'restaurant_viandes', 'multi_select', 2, true, '{"max_from_base": true}'),
  ('tacos_fr', 'garniture', 'custom.toppings', 'restaurant_garnitures', 'toggle_group', 3, false, '{}'),
  ('tacos_fr', 'sauce', 'custom.sauces', 'restaurant_sauces', 'chip_select', 4, false, '{"filter_field": "is_for_sandwich", "free_count_config": "free_sauces_sandwich"}'),
  ('tacos_fr', 'accompagnement', 'custom.side', 'restaurant_accompagnements', 'single_select', 5, false, '{}'),
  ('tacos_fr', 'boisson', 'custom.drink_upsell', 'menu_items_filter', 'upsell', 6, false, '{"filter_field": "product_type", "filter_value": "boisson", "enable_config": "enable_boisson_upsell"}'),
  ('tacos_fr', 'recap', 'custom.recap', 'none', 'recap', 7, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;

-- GENERIC (minimal: sauces + accompagnement + recap)
INSERT INTO cuisine_step_templates (cuisine_type, step_key, label_i18n, data_source, step_type, sort_order, required, config) VALUES
  ('generic', 'sauce', 'custom.sauces', 'restaurant_sauces', 'chip_select', 1, false, '{}'),
  ('generic', 'accompagnement', 'custom.side', 'restaurant_accompagnements', 'single_select', 2, false, '{}'),
  ('generic', 'boisson', 'custom.drink_upsell', 'menu_items_filter', 'upsell', 3, false, '{"filter_field": "product_type", "filter_value": "boisson", "enable_config": "enable_boisson_upsell"}'),
  ('generic', 'recap', 'custom.recap', 'none', 'recap', 4, true, '{}')
ON CONFLICT (cuisine_type, step_key) DO NOTHING;
