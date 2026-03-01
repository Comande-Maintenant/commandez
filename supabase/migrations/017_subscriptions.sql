-- 017: Subscriptions paywall system
-- Tables: subscriptions, promo_codes, promo_code_uses

-- ============================================================
-- 1. subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','trial','active','past_due','cancelled','expired','promo')),
  plan TEXT NOT NULL DEFAULT 'monthly'
    CHECK (plan IN ('monthly','annual')),
  billing_day INTEGER DEFAULT 15
    CHECK (billing_day IN (1,5,10,15,20,25)),
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  shopify_contract_id TEXT UNIQUE,
  shopify_customer_id TEXT,
  shopify_order_id TEXT,
  bonus_days INTEGER DEFAULT 0,
  promo_code_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_restaurant ON subscriptions(restaurant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_shopify_contract ON subscriptions(shopify_contract_id);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner can read their own subscriptions
CREATE POLICY "Owner reads own subscriptions" ON subscriptions
  FOR SELECT USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Service role has full access (via webhooks)
-- No explicit policy needed: service_role bypasses RLS

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();


-- ============================================================
-- 2. promo_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL
    CHECK (type IN ('free_days','discount_percent','discount_fixed','free_trial_extension')),
  value NUMERIC NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: public read for validation
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active promo codes" ON promo_codes
  FOR SELECT USING (active = true);


-- ============================================================
-- 3. promo_code_uses
-- ============================================================
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promo_code_id, restaurant_id)
);

ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own promo uses" ON promo_code_uses
  FOR SELECT USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );


-- ============================================================
-- 4. Initial promo codes
-- ============================================================
INSERT INTO promo_codes (code, type, value, max_uses, valid_until) VALUES
  ('LANCEMENT', 'free_days', 30, 100, now() + INTERVAL '6 months'),
  ('BIENVENUE', 'free_trial_extension', 14, NULL, NULL),
  ('MOITIE', 'discount_percent', 50, 200, now() + INTERVAL '3 months');
