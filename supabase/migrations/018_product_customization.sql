-- Migration: Product customization system (6 tables + product_type)
-- Replaces the monolithic customization_config JSONB with dedicated tables

-- 1. restaurant_bases (pain, galette, tacos, assiette, durum...)
CREATE TABLE IF NOT EXISTS restaurant_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}',
  price DECIMAL(8,2) NOT NULL DEFAULT 0,
  max_viandes INT DEFAULT 1,
  image TEXT,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. restaurant_viandes (proteines)
CREATE TABLE IF NOT EXISTS restaurant_viandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}',
  supplement DECIMAL(8,2) DEFAULT 0,
  image TEXT,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. restaurant_garnitures (salade, tomate, oignon...)
CREATE TABLE IF NOT EXISTS restaurant_garnitures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT true,
  price_x2 DECIMAL(8,2) DEFAULT 0.50,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. restaurant_sauces (blanche, samourai, algerienne...)
CREATE TABLE IF NOT EXISTS restaurant_sauces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}',
  is_for_sandwich BOOLEAN DEFAULT true,
  is_for_frites BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. restaurant_accompagnements (frites, ble, riz...)
CREATE TABLE IF NOT EXISTS restaurant_accompagnements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_translations JSONB DEFAULT '{}',
  has_sizes BOOLEAN DEFAULT false,
  price_small DECIMAL(8,2),
  price_medium DECIMAL(8,2),
  price_large DECIMAL(8,2),
  price_default DECIMAL(8,2),
  has_sauce_option BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. restaurant_order_config (global config per restaurant)
CREATE TABLE IF NOT EXISTS restaurant_order_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  free_sauces_sandwich INT DEFAULT 3,
  free_sauces_frites INT DEFAULT 2,
  extra_sauce_price DECIMAL(8,2) DEFAULT 0.50,
  suggest_sauce_from_sandwich BOOLEAN DEFAULT true,
  enable_boisson_upsell BOOLEAN DEFAULT true,
  enable_dessert_upsell BOOLEAN DEFAULT true,
  pain_supplement_price DECIMAL(8,2) DEFAULT 0.50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Add product_type column to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'simple';

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE restaurant_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_viandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_garnitures ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_sauces ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_accompagnements ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_order_config ENABLE ROW LEVEL SECURITY;

-- SELECT: public (clients need to see options)
CREATE POLICY "restaurant_bases_select" ON restaurant_bases FOR SELECT USING (true);
CREATE POLICY "restaurant_viandes_select" ON restaurant_viandes FOR SELECT USING (true);
CREATE POLICY "restaurant_garnitures_select" ON restaurant_garnitures FOR SELECT USING (true);
CREATE POLICY "restaurant_sauces_select" ON restaurant_sauces FOR SELECT USING (true);
CREATE POLICY "restaurant_accompagnements_select" ON restaurant_accompagnements FOR SELECT USING (true);
CREATE POLICY "restaurant_order_config_select" ON restaurant_order_config FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: owner only
CREATE POLICY "restaurant_bases_owner_insert" ON restaurant_bases FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_bases_owner_update" ON restaurant_bases FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_bases_owner_delete" ON restaurant_bases FOR DELETE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "restaurant_viandes_owner_insert" ON restaurant_viandes FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_viandes_owner_update" ON restaurant_viandes FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_viandes_owner_delete" ON restaurant_viandes FOR DELETE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "restaurant_garnitures_owner_insert" ON restaurant_garnitures FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_garnitures_owner_update" ON restaurant_garnitures FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_garnitures_owner_delete" ON restaurant_garnitures FOR DELETE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "restaurant_sauces_owner_insert" ON restaurant_sauces FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_sauces_owner_update" ON restaurant_sauces FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_sauces_owner_delete" ON restaurant_sauces FOR DELETE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "restaurant_accompagnements_owner_insert" ON restaurant_accompagnements FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_accompagnements_owner_update" ON restaurant_accompagnements FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_accompagnements_owner_delete" ON restaurant_accompagnements FOR DELETE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "restaurant_order_config_owner_insert" ON restaurant_order_config FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_order_config_owner_update" ON restaurant_order_config FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "restaurant_order_config_owner_delete" ON restaurant_order_config FOR DELETE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- ============================================================
-- Demo data: Le Bon Coin Resto
-- ============================================================

DO $$
DECLARE
  rid UUID := 'd1e2f3a4-b5c6-7890-abcd-ef1234567890';
BEGIN
  -- Bases (10)
  INSERT INTO restaurant_bases (restaurant_id, name, price, max_viandes, sort_order) VALUES
    (rid, 'Pain sandwich', 6.00, 1, 0),
    (rid, 'Galette', 6.50, 1, 1),
    (rid, 'Galette Geante', 9.00, 3, 2),
    (rid, 'Tacos 1 viande', 6.50, 1, 3),
    (rid, 'Tacos 2 viandes', 8.50, 2, 4),
    (rid, 'Tacos 3 viandes', 10.50, 3, 5),
    (rid, 'Tacos Geant', 11.00, 3, 6),
    (rid, 'Petite Assiette', 8.50, 1, 7),
    (rid, 'Grande Assiette', 10.50, 2, 8),
    (rid, 'Durum', 7.00, 1, 9);

  -- Viandes (10)
  INSERT INTO restaurant_viandes (restaurant_id, name, supplement, sort_order) VALUES
    (rid, 'Poulet curry', 0, 0),
    (rid, 'Poulet creme', 0, 1),
    (rid, 'Poulet kebab', 0, 2),
    (rid, 'Viande kebab veau-dinde', 0, 3),
    (rid, 'Kofta', 0, 4),
    (rid, 'Steak hache', 0, 5),
    (rid, 'Tenders', 0.50, 6),
    (rid, 'Cordon bleu', 0.50, 7),
    (rid, 'Merguez', 0, 8),
    (rid, 'Nuggets', 0, 9);

  -- Garnitures (3)
  INSERT INTO restaurant_garnitures (restaurant_id, name, is_default, sort_order) VALUES
    (rid, 'Salade', true, 0),
    (rid, 'Tomate', true, 1),
    (rid, 'Oignon', true, 2);

  -- Sauces (10)
  INSERT INTO restaurant_sauces (restaurant_id, name, is_for_sandwich, is_for_frites, sort_order) VALUES
    (rid, 'Blanche', true, true, 0),
    (rid, 'Samourai', true, true, 1),
    (rid, 'Algerienne', true, true, 2),
    (rid, 'Harissa', true, true, 3),
    (rid, 'Ketchup', true, true, 4),
    (rid, 'Mayonnaise', true, true, 5),
    (rid, 'BBQ', true, true, 6),
    (rid, 'Biggy burger', true, true, 7),
    (rid, 'Andalouse', true, true, 8),
    (rid, 'Burger', true, true, 9);

  -- Accompagnements (3)
  INSERT INTO restaurant_accompagnements (restaurant_id, name, has_sizes, price_small, price_medium, price_large, price_default, has_sauce_option, sort_order) VALUES
    (rid, 'Frites', true, 3.00, 3.50, 5.00, NULL, true, 0),
    (rid, 'Ble', false, NULL, NULL, NULL, 3.50, false, 1),
    (rid, 'Riz', false, NULL, NULL, NULL, 3.50, false, 2);

  -- Order config
  INSERT INTO restaurant_order_config (restaurant_id, free_sauces_sandwich, free_sauces_frites, extra_sauce_price, suggest_sauce_from_sandwich, enable_boisson_upsell, enable_dessert_upsell)
  VALUES (rid, 3, 2, 0.50, true, true, true);

  -- Update product_type for existing menu_items of Le Bon Coin Resto
  UPDATE menu_items SET product_type = 'sandwich_personnalisable'
    WHERE restaurant_id = rid AND category IN ('Kebabs', 'Tacos', 'Burgers');
  UPDATE menu_items SET product_type = 'menu'
    WHERE restaurant_id = rid AND category = 'Menus';
  UPDATE menu_items SET product_type = 'boisson'
    WHERE restaurant_id = rid AND category = 'Boissons';
  UPDATE menu_items SET product_type = 'dessert'
    WHERE restaurant_id = rid AND category = 'Desserts';
  UPDATE menu_items SET product_type = 'accompagnement'
    WHERE restaurant_id = rid AND category = 'Accompagnements';
END $$;
