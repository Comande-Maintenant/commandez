BEGIN;
CREATE OR REPLACE FUNCTION public.list_public_restaurants()
RETURNS TABLE(slug TEXT, updated_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT r.slug,greatest(r.updated_at,(SELECT max(m.updated_at) FROM menu_items m WHERE m.restaurant_id=r.id AND m.enabled)) FROM restaurants r
  WHERE r.owner_id IS NOT NULL AND NOT coalesce(r.is_demo,false)
    AND r.account_status='active' AND r.deactivated_at IS NULL
    AND EXISTS(SELECT 1 FROM menu_items m WHERE m.restaurant_id=r.id AND m.enabled)
  ORDER BY r.slug;
$$;
REVOKE ALL ON FUNCTION public.list_public_restaurants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_restaurants() TO anon,authenticated,service_role;
COMMIT;
