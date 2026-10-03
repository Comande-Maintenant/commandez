BEGIN;

-- Both existing entry points resolve /demo to the same seeded restaurant as
-- the application and public HTML. Demo activity never changes that identity.
-- Keep signatures, owners and existing EXECUTE ACLs; no tenant data is changed.
CREATE OR REPLACE FUNCTION public.get_demo_restaurant(p_slug TEXT)
RETURNS SETOF public.restaurants
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.restaurants r
  WHERE r.slug = CASE WHEN p_slug = 'demo' THEN 'antalya-kebab-moneteau' ELSE p_slug END
    AND r.is_demo IS TRUE;
$$;

CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_restaurant_payload(r)
  FROM public.restaurants r
  WHERE r.slug = CASE WHEN p_slug = 'demo' THEN 'antalya-kebab-moneteau' ELSE p_slug END
    -- Reserved demo aliases must not expose a row repurposed as a real merchant.
    AND (p_slug IS DISTINCT FROM 'demo' OR r.is_demo IS TRUE)
  LIMIT 1;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
