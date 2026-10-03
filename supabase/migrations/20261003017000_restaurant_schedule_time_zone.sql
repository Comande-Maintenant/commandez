BEGIN;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'Europe/Paris';

CREATE OR REPLACE FUNCTION public.valid_restaurant_time_zone(p_zone TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path=pg_catalog
AS $$ SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p_zone); $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.restaurants'::regclass AND conname='restaurants_time_zone_valid') THEN
    ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_time_zone_valid CHECK (public.valid_restaurant_time_zone(time_zone));
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.restaurant_is_open_at(p_restaurant_id UUID, p_at TIMESTAMPTZ DEFAULT now())
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  r public.restaurants;
  local_now TIMESTAMP;
  current_day INTEGER;
  current_minute INTEGER;
  day_entry JSONB;
  slot JSONB;
  opening INTEGER;
  closing INTEGER;
  day_number INTEGER;
BEGIN
  SELECT * INTO r FROM public.restaurants WHERE id=p_restaurant_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.availability_mode='always' THEN RETURN true; END IF;
  IF coalesce(r.availability_mode,'manual') <> 'auto'
    OR r.schedule IS NULL OR jsonb_typeof(r.schedule)<>'array' OR jsonb_array_length(r.schedule)=0
  THEN RETURN coalesce(r.is_open,false); END IF;
  local_now := p_at AT TIME ZONE r.time_zone;
  current_day := extract(dow FROM local_now)::INTEGER;
  current_minute := extract(hour FROM local_now)::INTEGER*60+extract(minute FROM local_now)::INTEGER;
  FOR day_entry IN SELECT value FROM jsonb_array_elements(r.schedule) LOOP
    IF day_entry->>'enabled' IS DISTINCT FROM 'true' OR coalesce(day_entry->>'day','') !~ '^[0-6]$'
      OR coalesce(jsonb_typeof(day_entry->'slots'),'null') <> 'array' THEN CONTINUE; END IF;
    day_number := (day_entry->>'day')::INTEGER;
    IF day_number NOT IN (current_day,(current_day+6)%7) THEN CONTINUE; END IF;
    FOR slot IN SELECT value FROM jsonb_array_elements(day_entry->'slots') LOOP
      IF coalesce(slot->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR coalesce(slot->>'close','') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' THEN CONTINUE; END IF;
      opening := split_part(slot->>'open',':',1)::INTEGER*60+split_part(slot->>'open',':',2)::INTEGER;
      closing := split_part(slot->>'close',':',1)::INTEGER*60+split_part(slot->>'close',':',2)::INTEGER;
      IF opening=closing THEN CONTINUE; END IF;
      IF closing>opening THEN
        IF day_number=current_day AND current_minute>=opening AND current_minute<closing THEN RETURN true; END IF;
      ELSE
        IF (day_number=current_day AND current_minute>=opening)
          OR (day_number=(current_day+6)%7 AND current_minute<closing) THEN RETURN true; END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.restaurant_is_open_at(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.public_restaurant_payload(r public.restaurants)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', r.id,
    'slug', r.slug,
    'name', r.name,
    'description', r.description,
    'cuisine', r.cuisine,
    'cuisine_type', r.cuisine_type,
    'image', r.image,
    'cover_image', r.cover_image,
    'rating', r.rating,
    'review_count', r.review_count,
    'address', r.address,
    'city', r.city,
    'estimated_time', r.estimated_time,
    'delivery_fee', r.delivery_fee,
    'minimum_order', r.minimum_order,
    'is_open', r.is_open,
    'is_accepting_orders', r.is_accepting_orders,
    'hours', r.hours,
    'categories', r.categories,
    'primary_color', r.primary_color,
    'bg_color', r.bg_color,
    'payment_methods', r.payment_methods,
    'website', r.website,
    'category_translations', r.category_translations,
    'restaurant_phone', r.restaurant_phone,
    'availability_mode', r.availability_mode,
    'schedule', r.schedule,
    'time_zone', r.time_zone,
    'order_mode', r.order_mode,
    'dine_in_capacity', r.dine_in_capacity,
    'notification_sound', r.notification_sound,
    'prep_time_config', r.prep_time_config,
    'customization_config', r.customization_config,
    'out_of_stock_ingredients', r.out_of_stock_ingredients,
    'deactivated_at', r.deactivated_at,
    'scheduled_deletion_at', r.scheduled_deletion_at,
    'bonus_weeks', r.bonus_weeks,
    'trial_end_date', r.trial_end_date,
    'subscription_status', r.subscription_status,
    'is_demo', r.is_demo,
    'business_type', r.business_type,
    'account_status', r.account_status
  );
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
  item_total NUMERIC;
  observed_ip TEXT;
  customer_is_banned BOOLEAN;
BEGIN
  SELECT *
  INTO restaurant_row
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND
    OR restaurant_row.deactivated_at IS NOT NULL
    OR NOT public.restaurant_is_open_at(p_restaurant_id)
    OR NOT coalesce(restaurant_row.is_accepting_orders, false)
  THEN
    RAISE EXCEPTION 'restaurant_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF NOT coalesce(restaurant_row.is_demo, false) AND NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';
  END IF;

  IF p_source='pos' AND NOT coalesce(restaurant_row.is_demo,false) AND
    (auth.uid() IS NULL OR (restaurant_row.owner_id IS DISTINCT FROM auth.uid() AND NOT public.is_super_admin())) THEN
    RAISE EXCEPTION 'pos_owner_required' USING ERRCODE='42501';
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
    IF item->>'type'='custom' AND p_source='pos' THEN
      item_quantity:=coalesce((item->>'quantity')::integer,1);
      IF item_quantity<1 OR item_quantity>50 THEN RAISE EXCEPTION 'invalid_item_quantity' USING ERRCODE='22023'; END IF;
      CONTINUE;
    END IF;
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

  canonical_total:=0;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF item->>'type'='custom' AND p_source='pos' THEN
      item_total:=public.calculate_pos_custom_total(p_restaurant_id,item->'customization_selection')*coalesce((item->>'quantity')::integer,1);
    ELSE
      item_total:=public.calculate_order_total(p_restaurant_id,jsonb_build_array(item));
    END IF;
    IF item_total IS NULL THEN RAISE EXCEPTION 'invalid_total' USING ERRCODE='22023'; END IF;
    canonical_total:=canonical_total+item_total;
  END LOOP;
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
    CASE WHEN auth.role() = 'authenticated' AND coalesce(p_source,'web') <> 'pos' THEN auth.uid() ELSE NULL END,
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
      CASE WHEN coalesce(p_source,'web') <> 'pos' THEN auth.uid() ELSE NULL END,
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

  IF auth.role() = 'authenticated' AND coalesce(p_source,'web') <> 'pos' THEN
    UPDATE public.customer_profiles
    SET total_orders = total_orders + 1,
        total_spent = total_spent + p_total,
        updated_at = now()
    WHERE id = auth.uid();
  END IF;

  RETURN created_order;
END;
$$;


-- Every public write must carry an idempotency key through place_order_once.
REVOKE ALL ON FUNCTION public.place_order(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,JSONB,NUMERIC,NUMERIC,TEXT,TEXT,TIMESTAMPTZ,TEXT,TIMESTAMPTZ,BOOLEAN) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
