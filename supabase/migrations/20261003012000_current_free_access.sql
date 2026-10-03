BEGIN;
-- Current offer is free for everyone. Historical billing records remain intact
-- except their application access status; no Stripe customer is charged here.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK(status IN ('free','pending_payment','trial','active','past_due','cancelled','expired','promo','incomplete','trialing'));
UPDATE public.restaurants SET subscription_status='free',trial_end_date=NULL;
UPDATE public.subscriptions SET status='free',trial_end=NULL;
-- Preserve referral identifiers but remove legacy automatic expiry defaults.
CREATE OR REPLACE FUNCTION public.generate_referral_code() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.referral_code IS NULL THEN NEW.referral_code:=upper(substr(md5(random()::text),1,6)); END IF;
 NEW.subscription_status:='free';
 NEW.trial_end_date:=NULL;
 RETURN NEW;
END; $$;
ALTER TABLE public.restaurants ALTER COLUMN subscription_status SET DEFAULT 'free';
ALTER TABLE public.subscriptions ALTER COLUMN status SET DEFAULT 'free';
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
    OR base_slug IN ('demo','inscription','connexion','signup','order','profil','admin','abonnement',
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
  WHILE EXISTS (SELECT 1 FROM restaurants WHERE slug=final_slug) LOOP
    suffix := suffix+1;
    final_slug := base_slug || '-' || suffix::text;
  END LOOP;
  INSERT INTO owners(id,email,phone) VALUES(uid,account_email,account_phone) ON CONFLICT(id) DO NOTHING;
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
  RETURNING id INTO rid;
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
CREATE OR REPLACE FUNCTION public.place_order(
  p_restaurant_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_order_type TEXT,
  p_source TEXT,
  p_covers INTEGER,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_total NUMERIC,
  p_notes TEXT,
  p_client_ip TEXT,
  p_pickup_time TIMESTAMPTZ,
  p_payment_method TEXT,
  p_estimated_ready_at TIMESTAMPTZ,
  p_is_test BOOLEAN
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_order public.orders;
  restaurant_row public.restaurants;
  item JSONB;
  item_id UUID;
  item_quantity INTEGER;
  canonical_total NUMERIC;
  observed_ip TEXT;
  customer_is_banned BOOLEAN;
BEGIN
  SELECT *
  INTO restaurant_row
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND
    OR restaurant_row.deactivated_at IS NOT NULL
    OR NOT coalesce(restaurant_row.is_open, false)
    OR NOT coalesce(restaurant_row.is_accepting_orders, false)
  THEN
    RAISE EXCEPTION 'restaurant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF NOT coalesce(restaurant_row.is_demo, false) AND NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';
  END IF;

  IF p_order_type NOT IN (
    'collect', 'delivery', 'pickup', 'dine_in', 'sur_place', 'a_emporter',
    'telephone'
  ) THEN
    RAISE EXCEPTION 'invalid_order_type' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 100
  THEN
    RAISE EXCEPTION 'invalid_items' USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_customer_name, ''))) < 1
    OR length(p_customer_name) > 120
    OR length(coalesce(p_customer_phone, '')) > 40
    OR length(coalesce(p_customer_email, '')) > 254
    OR length(coalesce(p_notes, '')) > 2000
  THEN
    RAISE EXCEPTION 'invalid_customer_fields' USING ERRCODE = '22023';
  END IF;

  -- Accepted only for backwards-compatible clients; the stored address always
  -- comes from trusted proxy headers, never from this caller-controlled hint.
  IF length(coalesce(p_client_ip, '')) > 255 THEN
    RAISE EXCEPTION 'invalid_client_ip_hint' USING ERRCODE = '22023';
  END IF;

  IF p_subtotal < 0
    OR p_total < 0
    OR p_subtotal > 100000
    OR p_total > 100000
    OR abs(p_subtotal - p_total) >= 0.02
  THEN
    RAISE EXCEPTION 'invalid_total' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      item_id := (item->>'menu_item_id')::UUID;
      item_quantity := coalesce((item->>'quantity')::INTEGER, 1);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_item_shape' USING ERRCODE = '22023';
    END;

    IF item_quantity < 1 OR item_quantity > 50 THEN
      RAISE EXCEPTION 'invalid_item_quantity' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.menu_items
      WHERE id = item_id
        AND restaurant_id = p_restaurant_id
        AND enabled = true
        AND coalesce(is_alcohol, false) = false
    ) THEN
      RAISE EXCEPTION 'invalid_menu_item' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  canonical_total := public.calculate_order_total(p_restaurant_id, p_items);
  IF canonical_total IS NULL OR abs(canonical_total - p_total) >= 0.02 THEN
    RAISE EXCEPTION 'invalid_total' USING ERRCODE = '22023';
  END IF;

  observed_ip := nullif(
    split_part(
      coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb
          ->>'x-forwarded-for',
        ''
      ),
      ',',
      1
    ),
    ''
  );

  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_customers
    WHERE restaurant_id = p_restaurant_id
      AND is_banned = true
      AND (ban_expires_at IS NULL OR ban_expires_at > now())
      AND (
        customer_user_id = auth.uid()
        OR customer_phone = left(coalesce(p_customer_phone, ''), 40)
        OR (
          observed_ip IS NOT NULL
          AND banned_ip = observed_ip
        )
      )
  )
  INTO customer_is_banned;

  IF customer_is_banned THEN
    RAISE EXCEPTION 'customer_banned' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.orders (
    restaurant_id,
    customer_name,
    customer_phone,
    customer_email,
    order_type,
    source,
    covers,
    items,
    subtotal,
    total,
    notes,
    client_ip,
    pickup_time,
    payment_method,
    estimated_ready_at,
    customer_user_id,
    is_test
  )
  VALUES (
    p_restaurant_id,
    trim(p_customer_name),
    left(coalesce(p_customer_phone, ''), 40),
    left(coalesce(p_customer_email, ''), 254),
    p_order_type,
    left(coalesce(p_source, 'web'), 40),
    p_covers,
    p_items,
    p_subtotal,
    p_total,
    coalesce(p_notes, ''),
    observed_ip,
    p_pickup_time,
    left(coalesce(p_payment_method, ''), 40),
    p_estimated_ready_at,
    CASE WHEN auth.role() = 'authenticated' THEN auth.uid() ELSE NULL END,
    coalesce(p_is_test, false)
  )
  RETURNING *
  INTO created_order;

  IF nullif(trim(coalesce(p_customer_phone, '')), '') IS NOT NULL THEN
    INSERT INTO public.restaurant_customers (
      restaurant_id,
      customer_phone,
      customer_name,
      customer_email,
      customer_user_id,
      first_order_at,
      last_order_at,
      total_orders,
      total_spent,
      average_basket,
      last_items
    )
    VALUES (
      p_restaurant_id,
      left(p_customer_phone, 40),
      trim(p_customer_name),
      left(coalesce(p_customer_email, ''), 254),
      auth.uid(),
      now(),
      now(),
      1,
      p_total,
      p_total,
      (
        SELECT coalesce(jsonb_agg(value->>'name'), '[]'::jsonb)
        FROM jsonb_array_elements(p_items)
      )
    )
    ON CONFLICT (restaurant_id, customer_phone)
    DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      customer_email = EXCLUDED.customer_email,
      customer_user_id = coalesce(public.restaurant_customers.customer_user_id, EXCLUDED.customer_user_id),
      last_order_at = now(),
      total_orders = public.restaurant_customers.total_orders + 1,
      total_spent = public.restaurant_customers.total_spent + EXCLUDED.total_spent,
      average_basket = (
        public.restaurant_customers.total_spent + EXCLUDED.total_spent
      ) / (public.restaurant_customers.total_orders + 1),
      last_items = EXCLUDED.last_items,
      updated_at = now();
  END IF;

  IF auth.role() = 'authenticated' THEN
    UPDATE public.customer_profiles
    SET total_orders = total_orders + 1,
        total_spent = total_spent + p_total,
        updated_at = now()
    WHERE id = auth.uid();
  END IF;

  RETURN created_order;
END;
$$;


NOTIFY pgrst,'reload schema';
COMMIT;
