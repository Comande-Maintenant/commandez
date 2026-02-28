ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS covers integer DEFAULT NULL;
