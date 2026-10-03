BEGIN;
-- No production data is deleted. The client account remains identifiable after
-- a phone/email edit, and retries use a one-shot request capability.
ALTER TABLE public.restaurant_customers ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS restaurant_customers_account_idx ON public.restaurant_customers(restaurant_id,customer_user_id);
-- Backfill only unambiguous single-account phone associations from actual orders.
UPDATE public.restaurant_customers c SET customer_user_id=o.uid FROM (
 SELECT restaurant_id,customer_phone,(array_agg(DISTINCT customer_user_id))[1] uid FROM public.orders
 WHERE customer_user_id IS NOT NULL GROUP BY restaurant_id,customer_phone HAVING count(DISTINCT customer_user_id)=1
) o WHERE c.restaurant_id=o.restaurant_id AND c.customer_phone=o.customer_phone AND c.customer_user_id IS NULL;
CREATE TABLE IF NOT EXISTS public.order_requests (
 request_id UUID PRIMARY KEY,
 customer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 request_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_requests FROM PUBLIC,anon,authenticated;
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

  IF NOT coalesce(restaurant_row.is_demo, false) AND (
    restaurant_row.subscription_status NOT IN ('active', 'promo', 'trial')
    OR (
      restaurant_row.subscription_status = 'trial'
      AND restaurant_row.trial_end_date IS NOT NULL
      AND restaurant_row.trial_end_date
        + make_interval(weeks => coalesce(restaurant_row.bonus_weeks, 0)) < now()
    )
  ) THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
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


CREATE OR REPLACE FUNCTION public.place_order_once(p_request_id UUID,p_order JSONB)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved public.order_requests; created public.orders; rid UUID; fingerprint TEXT;
BEGIN
 IF p_request_id IS NULL OR p_order IS NULL OR jsonb_typeof(p_order)<>'object' THEN
  RAISE EXCEPTION 'invalid_order_request' USING ERRCODE='22023';
 END IF;
 rid:=(p_order->>'restaurant_id')::uuid;
 fingerprint:=md5(p_order::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,2));
 SELECT * INTO saved FROM public.order_requests WHERE request_id=p_request_id;
 IF FOUND THEN
  IF saved.customer_user_id IS DISTINCT FROM auth.uid() OR saved.restaurant_id IS DISTINCT FROM rid OR saved.request_hash<>fingerprint THEN
   RAISE EXCEPTION 'order_request_conflict' USING ERRCODE='22023';
  END IF;
  SELECT * INTO created FROM public.orders WHERE id=saved.order_id;
  RETURN created;
 END IF;
 SELECT * INTO created FROM public.place_order(
  rid,p_order->>'customer_name',p_order->>'customer_phone',coalesce(p_order->>'customer_email',''),
  p_order->>'order_type',coalesce(p_order->>'source','web'),(p_order->>'covers')::int,
  p_order->'items',(p_order->>'subtotal')::numeric,(p_order->>'total')::numeric,
  coalesce(p_order->>'notes',''),NULL,(p_order->>'pickup_time')::timestamptz,
  coalesce(p_order->>'payment_method',''),(p_order->>'estimated_ready_at')::timestamptz,
  coalesce((p_order->>'is_test')::boolean,false));
 INSERT INTO public.order_requests(request_id,customer_user_id,restaurant_id,order_id,request_hash)
 VALUES(p_request_id,auth.uid(),rid,created.id,fingerprint);
 RETURN created;
END; $$;
-- Anonymous access is limited to genuine demo restaurants by place_order's
-- server-side checks. Caller source/is_demo hints never confer authority.
REVOKE ALL ON FUNCTION public.place_order_once(UUID,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order_once(UUID,JSONB) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.check_customer_ban(p_restaurant_id UUID,p_phone TEXT,p_email TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result JSONB;
BEGIN
 SELECT jsonb_build_object('banned',true,'reason',banned_reason,'expires',ban_expires_at)
 INTO result FROM public.restaurant_customers
 WHERE restaurant_id=p_restaurant_id AND is_banned=true AND (ban_expires_at IS NULL OR ban_expires_at>now())
 AND (customer_user_id=auth.uid() OR customer_phone=left(coalesce(p_phone,''),40)
 OR (nullif(lower(trim(coalesce(p_email,''))),'') IS NOT NULL AND lower(customer_email)=lower(trim(p_email)))) LIMIT 1;
 RETURN coalesce(result,jsonb_build_object('banned',false));
END; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
