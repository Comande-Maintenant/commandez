-- Prospection email tracking events (from Resend webhooks)
CREATE TABLE IF NOT EXISTS public.prospection_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  resend_id text NOT NULL,
  email text NOT NULL,
  event_type text NOT NULL, -- delivered, opened, clicked, bounced, complained
  link_url text, -- for click events
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_prospection_events_email ON public.prospection_events(email);
CREATE INDEX IF NOT EXISTS idx_prospection_events_type ON public.prospection_events(event_type);
CREATE INDEX IF NOT EXISTS idx_prospection_events_resend ON public.prospection_events(resend_id);

-- RLS
ALTER TABLE public.prospection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on prospection_events"
  ON public.prospection_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Prospection send log (mirror of sent_log.json for dashboard)
CREATE TABLE IF NOT EXISTS public.prospection_sends (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  resend_id text UNIQUE,
  email text NOT NULL,
  restaurant_name text,
  city text,
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospection_sends_email ON public.prospection_sends(email);

ALTER TABLE public.prospection_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on prospection_sends"
  ON public.prospection_sends
  FOR ALL
  USING (true)
  WITH CHECK (true);
