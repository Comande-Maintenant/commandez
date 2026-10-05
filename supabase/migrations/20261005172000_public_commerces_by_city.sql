BEGIN;
-- An additive, public projection only. Existing sitemap, by-slug and RLS stay intact.
CREATE OR REPLACE FUNCTION public.list_public_commerces_by_city(p_city TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  chosen_city TEXT;
  answer JSONB;
BEGIN
  IF p_city IS NULL OR char_length(p_city)>240 OR p_city ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid_city' USING ERRCODE='22023';
  END IF;
  chosen_city := normalize(btrim(p_city), NFC);
  chosen_city := regexp_replace(chosen_city, ' +', ' ', 'g');
  IF char_length(chosen_city) NOT BETWEEN 1 AND 80 OR chosen_city !~ '[[:alpha:]]'
    OR chosen_city !~ '^[[:alnum:] .’''-]+$' THEN
    RAISE EXCEPTION 'invalid_city' USING ERRCODE='22023';
  END IF;
  chosen_city := replace(regexp_replace(normalize(lower(chosen_city), NFD), U&'[\0300-\036f]', '', 'g'), '’', '''');
  WITH eligible AS MATERIALIZED (
    SELECT r.slug,r.name,r.city,r.image,r.cover_image,r.cuisine,r.cuisine_type,r.business_type
    FROM public.restaurants r
    WHERE replace(regexp_replace(normalize(lower(regexp_replace(btrim(r.city), ' +', ' ', 'g')), NFD), U&'[\0300-\036f]', '', 'g'), '’', '''')=chosen_city
      AND r.owner_id IS NOT NULL AND NOT coalesce(r.is_demo,false)
      AND r.account_status='active' AND r.deactivated_at IS NULL AND r.scheduled_deletion_at IS NULL
      AND EXISTS (SELECT 1 FROM public.menu_items m WHERE m.restaurant_id=r.id
        AND m.enabled IS TRUE AND m.is_alcohol IS FALSE)
    ORDER BY r.name,r.slug
    LIMIT 101
  ), shown AS (SELECT * FROM eligible ORDER BY name,slug LIMIT 100)
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name,s.slug) FROM shown s),'[]'::jsonb),
    'has_more',(SELECT count(*)>100 FROM eligible)) INTO answer;
  RETURN answer;
END;
$$;
REVOKE ALL ON FUNCTION public.list_public_commerces_by_city(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_commerces_by_city(TEXT) TO anon,authenticated,service_role;
COMMIT;
