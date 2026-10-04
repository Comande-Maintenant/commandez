BEGIN;
-- /decouvrir is now an application route, matched case-insensitively.
-- Reserve it even for direct owner writes; leave existing merchant data intact.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.restaurants'::regclass AND conname='restaurants_discovery_slug_reserved') THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_discovery_slug_reserved
      CHECK (lower(slug) <> 'decouvrir') NOT VALID;
  END IF;
END; $$;
ALTER TABLE public.restaurants VALIDATE CONSTRAINT restaurants_discovery_slug_reserved;

-- Preserve free access, confirmed-owner authentication, collision retries and
-- onboarding idempotency. Only the new reserved route is added to this RPC.
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_key UUID, p_restaurant JSONB, p_menu JSONB DEFAULT '[]', p_defaults JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rid UUID;
  result public.restaurants;
  account_email TEXT;
  account_phone TEXT;
  base_slug TEXT;
  final_slug TEXT;
  suffix INTEGER := 1;
  item JSONB;
  config JSONB;
  trial_start_at TIMESTAMPTZ := now();
BEGIN
  SELECT email, coalesce(raw_user_meta_data->>'phone','') INTO account_email, account_phone
    FROM auth.users WHERE id=uid AND email_confirmed_at IS NOT NULL;
  IF uid IS NULL OR account_email IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';
  END IF;
  IF p_key IS NULL THEN RAISE EXCEPTION 'creation_key_required' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || p_key::text,0));
  SELECT * INTO result FROM restaurants WHERE owner_id=uid AND onboarding_key=p_key;
  IF FOUND THEN RETURN jsonb_build_object('id',result.id,'slug',result.slug,'name',result.name,'created',false); END IF;
  IF length(trim(coalesce(p_restaurant->>'name','')))=0 OR length(p_restaurant->>'name')>200 THEN
    RAISE EXCEPTION 'invalid_restaurant' USING ERRCODE='22023';
  END IF;
  base_slug := p_restaurant->>'slug';
  IF base_slug IS NULL OR length(base_slug)>150 OR base_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR base_slug IN ('demo','decouvrir','inscription','connexion','signup','order','profil','admin','abonnement',
      'choisir-plan','abonnement-confirme','suivi','super-admin','unsubscribe','upload',
      'mot-de-passe-oublie','reinitialiser-mot-de-passe') THEN
    RAISE EXCEPTION 'invalid_slug' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_menu)<>'array' OR jsonb_array_length(p_menu)>500 THEN
    RAISE EXCEPTION 'invalid_menu' USING ERRCODE='22023';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_menu) LOOP
    IF length(trim(coalesce(item->>'name','')))=0 OR length(trim(coalesce(item->>'category','')))=0
      OR item->>'price' IS NULL OR (item->>'price')::numeric<0 OR (item->>'price')::numeric>9999 THEN
      RAISE EXCEPTION 'invalid_menu' USING ERRCODE='22023';
    END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended(base_slug,1));
  final_slug := base_slug;
  INSERT INTO owners(id,email,phone) VALUES(uid,account_email,account_phone) ON CONFLICT(id) DO NOTHING;
  LOOP
    WHILE EXISTS (SELECT 1 FROM restaurants WHERE slug=final_slug) LOOP
      suffix := suffix+1;
      final_slug := base_slug || '-' || suffix::text;
    END LOOP;
  INSERT INTO restaurants(name,slug,owner_id,onboarding_key,address,city,cuisine,cuisine_type,
    description,image,restaurant_phone,google_place_id,website,hours,primary_color,bg_color,
    preferred_language,subscription_plan,subscription_status,trial_end_date,payment_methods,
    categories,rating,review_count,is_open,is_accepting_orders,account_status,schedule,availability_mode)
  VALUES(trim(p_restaurant->>'name'),final_slug,uid,p_key,p_restaurant->>'address',p_restaurant->>'city',
    p_restaurant->>'cuisine',coalesce(p_restaurant->>'cuisine_type','generic'),p_restaurant->>'description',
    p_restaurant->>'image',p_restaurant->>'restaurant_phone',p_restaurant->>'google_place_id',
    p_restaurant->>'website',p_restaurant->>'hours',coalesce(p_restaurant->>'primary_color','#000000'),
    coalesce(p_restaurant->>'bg_color','#ffffff'),coalesce(p_restaurant->>'preferred_language','fr'),
    'monthly','free',NULL,ARRAY['cash'],
    ARRAY(SELECT DISTINCT value->>'category' FROM jsonb_array_elements(p_menu)),
    NULL,0,true,true,'active',p_restaurant->'schedule',
    CASE WHEN p_restaurant->'schedule' IS NOT NULL AND p_restaurant->'schedule'<>'null'::jsonb THEN 'auto' ELSE 'manual' END)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO rid;
    EXIT WHEN rid IS NOT NULL;
    -- Another base can reserve this suffix after the existence check. Only
    -- slug conflicts are retried; all other constraints keep their errors.
    suffix := suffix+1;
    final_slug := base_slug || '-' || suffix::text;
  END LOOP;
  INSERT INTO menu_items(restaurant_id,name,description,price,category,product_type,sort_order,supplements,variants,tags,enabled)
    SELECT rid,value->>'name',coalesce(value->>'description',''),(value->>'price')::numeric,
      value->>'category',coalesce(value->>'product_type','simple'),ordinality::integer,
      coalesce(value->'supplements','[]'),coalesce(value->'variants','[]'),
      ARRAY(SELECT jsonb_array_elements_text(coalesce(value->'tags','[]'))),true
    FROM jsonb_array_elements(p_menu) WITH ORDINALITY;
  INSERT INTO restaurant_garnitures(restaurant_id,name,name_translations,is_default,price_x2,sort_order,enabled)
    SELECT rid,value->>'name',coalesce(value->'name_translations','{}'),coalesce((value->>'is_default')::boolean,false),0,ordinality::integer,true
    FROM jsonb_array_elements(coalesce(p_defaults->'garnitures','[]')) WITH ORDINALITY;
  INSERT INTO restaurant_sauces(restaurant_id,name,name_translations,is_for_sandwich,is_for_frites,sort_order,enabled)
    SELECT rid,value->>'name',coalesce(value->'name_translations','{}'),coalesce((value->>'is_for_sandwich')::boolean,true),
      coalesce((value->>'is_for_frites')::boolean,true),ordinality::integer,true
    FROM jsonb_array_elements(coalesce(p_defaults->'sauces','[]')) WITH ORDINALITY;
  INSERT INTO restaurant_viandes(restaurant_id,name,name_translations,supplement,sort_order,enabled)
    SELECT rid,value->>'name',coalesce(value->'name_translations','{}'),coalesce((value->>'supplement')::numeric,0),ordinality::integer,true
    FROM jsonb_array_elements(coalesce(p_defaults->'viandes','[]')) WITH ORDINALITY;
  config := p_defaults->'orderConfig';
  IF config IS NOT NULL THEN
    INSERT INTO restaurant_order_config(restaurant_id,free_sauces_sandwich,free_sauces_frites,extra_sauce_price,
      suggest_sauce_from_sandwich,enable_boisson_upsell,enable_dessert_upsell)
    VALUES(rid,coalesce((config->>'free_sauces_sandwich')::integer,2),coalesce((config->>'free_sauces_frites')::integer,1),
      coalesce((config->>'extra_sauce_price')::numeric,0.5),coalesce((config->>'suggest_sauce_from_sandwich')::boolean,true),
      coalesce((config->>'enable_boisson_upsell')::boolean,true),coalesce((config->>'enable_dessert_upsell')::boolean,true));
  END IF;
  INSERT INTO subscriptions(restaurant_id,status,plan,billing_day,trial_start,trial_end)
    VALUES(rid,'free','monthly',15,trial_start_at,NULL);
  RETURN jsonb_build_object('id',rid,'slug',final_slug,'name',trim(p_restaurant->>'name'),'created',true);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_onboarding(UUID,JSONB,JSONB,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(UUID,JSONB,JSONB,JSONB) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
