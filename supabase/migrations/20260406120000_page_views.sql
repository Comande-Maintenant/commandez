-- Page views tracking for acquisition analytics
CREATE TABLE IF NOT EXISTS page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  visitor_id text,
  user_id uuid,
  page_path text NOT NULL,
  page_type text NOT NULL DEFAULT 'other',
  side text NOT NULL DEFAULT 'user',
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text,
  language text,
  user_agent text,
  screen_width int,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_type ON page_views (page_type);
CREATE INDEX IF NOT EXISTS idx_page_views_side ON page_views (side);

-- RLS: anon can insert (tracking), super_admin can read all
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page views"
  ON page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Super admin can read page views"
  ON page_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM owners WHERE owners.id = auth.uid() AND owners.role = 'super_admin'
    )
  );
