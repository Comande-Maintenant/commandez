-- Email logging and user preferences for unsubscribe/anti-spam
-- Idempotent (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  restaurant_id UUID REFERENCES restaurants(id),
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  resend_id TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_type ON email_logs(user_id, email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_restaurant_type ON email_logs(restaurant_id, email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

CREATE TABLE IF NOT EXISTS user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  marketing_emails BOOLEAN DEFAULT true,
  subscription_emails BOOLEAN DEFAULT true,
  referral_emails BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: service_role only (edge functions use service role key)
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (no user-facing policies needed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_logs' AND policyname = 'service_role_email_logs') THEN
    CREATE POLICY service_role_email_logs ON email_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_email_preferences' AND policyname = 'service_role_email_prefs') THEN
    CREATE POLICY service_role_email_prefs ON user_email_preferences FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
