-- Referral system: add referral columns to restaurants + referrals tracking table

-- Add referral columns to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES restaurants(id);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bonus_weeks INTEGER DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

-- Referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES restaurants(id),
  referee_id UUID REFERENCES restaurants(id),
  referee_email TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, expired
  bonus_weeks_granted INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Auto-generate referral code on restaurant creation
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(random()::text), 1, 6));
  END IF;
  IF NEW.trial_end_date IS NULL THEN
    NEW.trial_end_date := NOW() + INTERVAL '4 weeks';
  END IF;
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'trial';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_referral_code ON restaurants;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON restaurants
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- RLS for referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can view own referrals" ON referrals;
CREATE POLICY "Owner can view own referrals" ON referrals
  FOR SELECT USING (
    referrer_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "System can insert referrals" ON referrals;
CREATE POLICY "System can insert referrals" ON referrals
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update referrals" ON referrals;
CREATE POLICY "System can update referrals" ON referrals
  FOR UPDATE USING (true);
