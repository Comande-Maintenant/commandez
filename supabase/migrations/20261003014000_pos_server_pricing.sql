BEGIN;
-- The caisse configuration is a second catalog owned by the merchant. Its
-- option identifiers are repriced from that catalog, never from submitted prices.
CREATE OR REPLACE FUNCTION public.calculate_pos_custom_total(p_restaurant_id UUID,p_selection JSONB)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
 cfg JSONB; step JSONB; option_row JSONB; selected JSONB; entry JSONB;
 ids JSONB; key TEXT; option_id TEXT; step_id TEXT; level TEXT;
 subtotal NUMERIC; multiplier INTEGER; max_count INTEGER; count_selected INTEGER;
 acc JSONB; portion JSONB; base_option JSONB; stock JSONB; seen TEXT[];
BEGIN
 SELECT customization_config,out_of_stock_ingredients INTO cfg,stock FROM restaurants WHERE id=p_restaurant_id;
 IF cfg IS NULL OR coalesce((cfg->>'enabled')::boolean,false)=false OR jsonb_typeof(p_selection)<>'object' THEN RETURN NULL; END IF;
 subtotal:=(cfg->>'base_price')::numeric;
 IF subtotal IS NULL OR subtotal<0 THEN RETURN NULL; END IF;
 -- A merchant can reorder the steps. Resolve the base before checking meat
 -- counts rather than depending on which step the loop encounters first.
 SELECT o.value INTO base_option
 FROM jsonb_array_elements(cfg->'steps') s(value),LATERAL jsonb_array_elements(s.value->'options') o(value)
 WHERE s.value->>'id'='base' AND o.value->>'id'=p_selection->>'base_id' LIMIT 1;
 FOR step IN SELECT value FROM jsonb_array_elements(cfg->'steps') LOOP
  step_id:=step->>'id';
  CASE step_id
   WHEN 'base' THEN ids:=CASE WHEN nullif(p_selection->>'base_id','') IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(p_selection->>'base_id') END;
   WHEN 'viande' THEN ids:=coalesce(p_selection->'viande_ids','[]');
   WHEN 'garniture' THEN ids:=coalesce(p_selection->'garnitures','[]');
   WHEN 'sauces' THEN ids:=coalesce(p_selection->'sauce_ids','[]');
   WHEN 'supplements' THEN ids:=coalesce(p_selection->'supplements','[]');
   WHEN 'accompagnement' THEN ids:=CASE WHEN p_selection->'accompagnement' IS NULL OR p_selection->'accompagnement'='null'::jsonb THEN '[]'::jsonb ELSE jsonb_build_array(p_selection->'accompagnement') END;
   ELSE CONTINUE;
  END CASE;
  IF jsonb_typeof(ids)<>'array' OR jsonb_array_length(ids)>100 THEN RETURN NULL; END IF;
  IF step_id='garniture' THEN
   -- "non" is an explicit exclusion, not a selected ingredient. It neither
   -- counts toward selection limits nor checks availability or adds a price.
   SELECT coalesce(jsonb_agg(value),'[]'::jsonb) INTO ids
   FROM jsonb_array_elements(ids) WHERE value->>'level' IS DISTINCT FROM 'non';
  END IF;
  count_selected:=jsonb_array_length(ids);
  IF coalesce((step->>'required')::boolean,false) AND count_selected=0 THEN RETURN NULL; END IF;
  max_count:=coalesce((step->>'max_selections')::integer,100);
  IF step_id IN ('base','accompagnement') THEN max_count:=1; END IF;
  IF count_selected>max_count THEN RETURN NULL; END IF;
  IF step_id='viande' AND count_selected>1 AND NOT coalesce((base_option->>'allow_multi_meat')::boolean,false) THEN RETURN NULL; END IF;
  seen:=ARRAY[]::text[];
  FOR entry IN SELECT value FROM jsonb_array_elements(ids) LOOP
   option_id:=CASE WHEN step_id IN ('garniture','supplements','accompagnement') THEN entry->>'option_id' ELSE trim(both '"' from entry::text) END;
   IF option_id IS NULL OR option_id=ANY(seen) OR coalesce(stock,'[]'::jsonb) ? option_id THEN RETURN NULL; END IF;
   seen:=array_append(seen,option_id);
   SELECT value INTO option_row FROM jsonb_array_elements(step->'options') WHERE value->>'id'=option_id LIMIT 1;
   IF option_row IS NULL OR option_row->>'price_modifier' IS NULL THEN RETURN NULL; END IF;
   multiplier:=1;
   IF step_id='base' THEN base_option:=option_row; END IF;
   IF step_id='garniture' THEN
    level:=entry->>'level';
    IF level NOT IN ('non','oui','x2') OR level IS NULL THEN RETURN NULL; END IF;
    multiplier:=CASE WHEN level='x2' THEN 1 ELSE 0 END;
   END IF;
   IF step_id='supplements' THEN
    multiplier:=(entry->>'quantity')::integer;
    IF multiplier IS NULL OR multiplier<0 OR multiplier>coalesce((step->>'max_qty_per_option')::integer,50) THEN RETURN NULL; END IF;
   END IF;
   subtotal:=subtotal+(option_row->>'price_modifier')::numeric*multiplier;
   IF step_id='accompagnement' THEN
    acc:=entry;
    IF jsonb_array_length(coalesce(option_row->'portion_options','[]'))>0 THEN
     SELECT value INTO portion FROM jsonb_array_elements(option_row->'portion_options') WHERE value->>'id'=coalesce(acc->>'portion','normale') LIMIT 1;
     IF portion IS NULL THEN RETURN NULL; END IF;
     subtotal:=subtotal+coalesce((portion->>'price_modifier')::numeric,0);
    ELSIF coalesce(acc->>'portion','normale')<>'normale' THEN RETURN NULL;
    END IF;
    IF nullif(acc->>'sub_sauce_id','') IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(cfg->'steps') s,LATERAL jsonb_array_elements(s->'options') o
     WHERE s->>'id'=step->>'sub_sauce_step' AND o->>'id'=acc->>'sub_sauce_id'
    ) THEN RETURN NULL; END IF;
   END IF;
  END LOOP;
 END LOOP;
 IF subtotal<0 OR subtotal>100000 THEN RETURN NULL; END IF;
 RETURN round(subtotal,2);
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.calculate_pos_custom_total(UUID,JSONB) FROM PUBLIC,anon,authenticated;
-- The updated place_order definition is appended below.
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


NOTIFY pgrst,'reload schema';
COMMIT;
