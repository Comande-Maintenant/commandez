-- Add Stripe columns to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Update status CHECK to include all Stripe statuses
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending_payment','trial','active','past_due','cancelled','expired','promo','incomplete','trialing'));

-- RLS: service_role can do all (for webhooks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'service_role_subscriptions' AND tablename = 'subscriptions'
  ) THEN
    CREATE POLICY "service_role_subscriptions" ON subscriptions
      FOR ALL USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;
