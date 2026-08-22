-- Restore the versioned backend contract and close legacy RLS gaps.
-- This migration is intentionally explicit: clean databases had no usable API
-- grants, while historical permissive policies would expose private data if
-- broad grants were restored.

BEGIN;

-- ---------------------------------------------------------------------------
-- Missing application tables and columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_ip TEXT;

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  default_order_type TEXT NOT NULL DEFAULT 'collect'
    CHECK (default_order_type IN (
      'collect', 'delivery', 'pickup', 'dine_in', 'sur_place', 'a_emporter'
    )),
  total_orders INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stock_photos (
  id TEXT PRIMARY KEY,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_photos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Shared authorization helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owners
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

DROP POLICY IF EXISTS "Restaurants are publicly readable" ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select ON public.restaurants;
DROP POLICY IF EXISTS restaurants_insert ON public.restaurants;
DROP POLICY IF EXISTS restaurants_update ON public.restaurants;
DROP POLICY IF EXISTS restaurants_delete ON public.restaurants;
CREATE POLICY restaurants_select ON public.restaurants
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin());
CREATE POLICY restaurants_insert ON public.restaurants
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY restaurants_update ON public.restaurants
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());
CREATE POLICY restaurants_delete ON public.restaurants
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS owners_self_read ON public.owners;
DROP POLICY IF EXISTS owners_self_insert ON public.owners;
DROP POLICY IF EXISTS owners_self_update ON public.owners;
CREATE POLICY owners_self_read ON public.owners
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY owners_self_insert ON public.owners
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND coalesce(role, 'owner') = 'owner');

DROP POLICY IF EXISTS "Public reads active promo codes" ON public.promo_codes;
CREATE POLICY promo_codes_super_admin_select ON public.promo_codes
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY subscriptions_owner_insert ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
    AND status = 'trial'
    AND coalesce(stripe_customer_id, '') = ''
    AND coalesce(stripe_subscription_id, '') = ''
  );

-- ---------------------------------------------------------------------------
-- Remove legacy policies that bypass tenant isolation
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Orders can be updated" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_anon_select" ON public.orders;
DROP POLICY IF EXISTS "orders_select_demo" ON public.orders;
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;

CREATE POLICY orders_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    customer_user_id = auth.uid()
    OR auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = orders.restaurant_id
    )
    OR public.is_super_admin()
  );

CREATE POLICY orders_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = orders.restaurant_id
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = orders.restaurant_id
    )
    OR public.is_super_admin()
  );

CREATE POLICY orders_delete ON public.orders
  FOR DELETE TO authenticated
  USING (
    auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = orders.restaurant_id
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Anyone can insert restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Restaurant hours can be updated" ON public.restaurant_hours;

DROP POLICY IF EXISTS restaurant_customers_insert ON public.restaurant_customers;
DROP POLICY IF EXISTS restaurant_customers_update ON public.restaurant_customers;
DROP POLICY IF EXISTS restaurant_customers_select ON public.restaurant_customers;

CREATE POLICY restaurant_customers_select ON public.restaurant_customers
  FOR SELECT TO authenticated
  USING (
    auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = restaurant_customers.restaurant_id
    )
    OR public.is_super_admin()
  );

CREATE POLICY restaurant_customers_insert ON public.restaurant_customers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = restaurant_customers.restaurant_id
    )
    OR public.is_super_admin()
  );

CREATE POLICY restaurant_customers_update ON public.restaurant_customers
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = restaurant_customers.restaurant_id
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    auth.uid() = (
      SELECT owner_id
      FROM public.restaurants
      WHERE id = restaurant_customers.restaurant_id
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS service_role_email_logs ON public.email_logs;
CREATE POLICY service_role_email_logs ON public.email_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_email_prefs ON public.user_email_preferences;
CREATE POLICY service_role_email_prefs ON public.user_email_preferences
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on prospection_events"
  ON public.prospection_events;
CREATE POLICY "Service role full access on prospection_events"
  ON public.prospection_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on prospection_sends"
  ON public.prospection_sends;
CREATE POLICY "Service role full access on prospection_sends"
  ON public.prospection_sends
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_profiles_self_select ON public.customer_profiles;
DROP POLICY IF EXISTS customer_profiles_self_insert ON public.customer_profiles;
DROP POLICY IF EXISTS customer_profiles_self_update ON public.customer_profiles;
DROP POLICY IF EXISTS customer_profiles_self_delete ON public.customer_profiles;

CREATE POLICY customer_profiles_self_select ON public.customer_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY customer_profiles_self_insert ON public.customer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY customer_profiles_self_update ON public.customer_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY customer_profiles_self_delete ON public.customer_profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS stock_photos_public_select ON public.stock_photos;
DROP POLICY IF EXISTS stock_photos_admin_write ON public.stock_photos;
CREATE POLICY stock_photos_public_select ON public.stock_photos
  FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY stock_photos_admin_write ON public.stock_photos
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Prospect uploads are capability-gated by the photo-upload Edge Function.
-- The bucket is private and has no direct anon/authenticated object policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prospect-uploads',
  'prospect-uploads',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS prospect_uploads_public_read ON storage.objects;
DROP POLICY IF EXISTS prospect_uploads_public_insert ON storage.objects;
DROP POLICY IF EXISTS prospect_uploads_auth_read ON storage.objects;
DROP POLICY IF EXISTS prospect_uploads_auth_insert ON storage.objects;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'menu-uploads';

DROP POLICY IF EXISTS public_menu_upload ON storage.objects;
DROP POLICY IF EXISTS public_menu_read ON storage.objects;
DROP POLICY IF EXISTS menu_uploads_owner_read ON storage.objects;
DROP POLICY IF EXISTS menu_uploads_owner_insert ON storage.objects;
DROP POLICY IF EXISTS menu_uploads_owner_delete ON storage.objects;
CREATE POLICY menu_uploads_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'menu-uploads' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY menu_uploads_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-uploads' AND (storage.foldername(name))[1] = auth.uid()::TEXT);
CREATE POLICY menu_uploads_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'menu-uploads' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

-- ---------------------------------------------------------------------------
-- Public restaurant projection (never expose owner/billing identifiers)
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_restaurant_payload(r)
  FROM public.restaurants r
  WHERE r.slug = p_slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_restaurant_by_id(p_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_restaurant_payload(r)
  FROM public.restaurants r
  WHERE r.id = p_id
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous safety helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_customer_ban(
  p_restaurant_id UUID,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'banned', true,
    'reason', banned_reason,
    'expires', ban_expires_at
  )
  INTO result
  FROM public.restaurant_customers
  WHERE restaurant_id = p_restaurant_id
    AND is_banned = true
    AND (
      customer_phone = left(coalesce(p_phone, ''), 40)
      OR (
        nullif(lower(trim(coalesce(p_email, ''))), '') IS NOT NULL
        AND lower(customer_email) = lower(trim(p_email))
      )
    )
    AND (ban_expires_at IS NULL OR ban_expires_at > now())
  LIMIT 1;

  RETURN coalesce(result, jsonb_build_object('banned', false));
END;
$$;

-- Canonical pricing. Client-provided price, extra_cost and supplement prices are
-- display hints only: every billable selection is resolved against this tenant's
-- enabled catalogue before an order can be inserted.
CREATE OR REPLACE FUNCTION public.calculate_order_total(
  p_restaurant_id UUID,
  p_items JSONB
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  item_row public.menu_items%ROWTYPE;
  choice JSONB;
  selection JSONB;
  canonical JSONB;
  choices JSONB;
  selections JSONB;
  restaurant_cuisine TEXT;
  step_key TEXT;
  selection_id TEXT;
  selection_name TEXT;
  selection_size TEXT;
  unit_total NUMERIC;
  calculated_total NUMERIC := 0;
  canonical_price NUMERIC;
  config_free_sauces INTEGER := 3;
  config_free_frites_sauces INTEGER := 2;
  config_extra_sauce NUMERIC := 0.50;
  config_free_accomp INTEGER := 1;
  config_extra_accomp NUMERIC := 0;
  base_max_viandes INTEGER := 1;
  selection_count INTEGER;
  sauce_count INTEGER;
  quantity INTEGER;
  has_custom_sauces BOOLEAN;
  seen_ids TEXT[];
BEGIN
  SELECT cuisine_type
  INTO restaurant_cuisine
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN NULL;
  END IF;

  SELECT
    coalesce(free_sauces_sandwich, 3),
    coalesce(free_sauces_frites, 2),
    coalesce(extra_sauce_price, 0.50),
    coalesce(free_accompagnements, 1),
    coalesce(extra_accompagnement_price, 0)
  INTO
    config_free_sauces,
    config_free_frites_sauces,
    config_extra_sauce,
    config_free_accomp,
    config_extra_accomp
  FROM public.restaurant_order_config
  WHERE restaurant_id = p_restaurant_id;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    quantity := coalesce((item->>'quantity')::INTEGER, 1);
    SELECT *
    INTO item_row
    FROM public.menu_items
    WHERE id = (item->>'menu_item_id')::UUID
      AND restaurant_id = p_restaurant_id
      AND enabled = true
      AND coalesce(is_alcohol, false) = false;

    IF NOT FOUND OR quantity < 1 OR quantity > 50 THEN
      RETURN NULL;
    END IF;

    unit_total := item_row.price;
    base_max_viandes := 1;
    choices := coalesce(item->'custom_choices', '[]'::jsonb);
    IF jsonb_typeof(choices) <> 'array' OR jsonb_array_length(choices) > 30 THEN
      RETURN NULL;
    END IF;

    -- Reject duplicate step objects, which would otherwise permit ambiguous bills.
    IF (
      SELECT count(*) <> count(DISTINCT value->>'stepKey')
      FROM jsonb_array_elements(choices)
    ) THEN
      RETURN NULL;
    END IF;

    has_custom_sauces := EXISTS (
      SELECT 1 FROM jsonb_array_elements(choices)
      WHERE value->>'stepKey' = 'sauce'
    );

    FOR choice IN SELECT value FROM jsonb_array_elements(choices)
    LOOP
      step_key := choice->>'stepKey';
      selections := coalesce(choice->'selections', '[]'::jsonb);
      IF step_key IS NULL
        OR jsonb_typeof(selections) <> 'array'
        OR jsonb_array_length(selections) > 50
      THEN
        RETURN NULL;
      END IF;
      selection_count := jsonb_array_length(selections);

      IF step_key = 'variant' THEN
        IF selection_count <> 1 THEN RETURN NULL; END IF;
        selection := selections->0;
        SELECT value INTO canonical
        FROM jsonb_array_elements(coalesce(item_row.variants, '[]'::jsonb))
        WHERE value->>'name' = coalesce(selection->>'name', selection->>'id')
        LIMIT 1;
        IF canonical IS NULL THEN RETURN NULL; END IF;
        unit_total := (canonical->>'price')::NUMERIC;

      ELSIF step_key = 'base' THEN
        IF selection_count <> 1 THEN RETURN NULL; END IF;
        selection := selections->0;
        SELECT price, max_viandes
        INTO canonical_price, base_max_viandes
        FROM public.restaurant_bases
        WHERE id = (selection->>'id')::UUID
          AND restaurant_id = p_restaurant_id
          AND enabled = true
          AND ("group" IS NULL OR "group" = item_row.product_type)
        LIMIT 1;
        IF NOT FOUND THEN RETURN NULL; END IF;
        unit_total := canonical_price;

      ELSIF step_key = 'viande' THEN
        IF selection_count > base_max_viandes THEN RETURN NULL; END IF;
        selection_count := 0;
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          SELECT supplement INTO canonical_price
          FROM public.restaurant_viandes
          WHERE id = (split_part(selection->>'id', '__', 1))::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + canonical_price;
          IF selection_count > 0 THEN
            SELECT coalesce((config->>'extra_viande_price')::NUMERIC, 0)
            INTO canonical_price
            FROM public.cuisine_step_templates template
            WHERE template.cuisine_type = restaurant_cuisine
              AND template.step_key = 'viande'
            ORDER BY template.sort_order
            LIMIT 1;
            unit_total := unit_total + coalesce(canonical_price, 0);
          END IF;
          selection_count := selection_count + 1;
        END LOOP;

      ELSIF step_key = 'sauce' OR step_key = 'frites_sauce' THEN
        seen_ids := ARRAY[]::TEXT[];
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := selection->>'id';
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          IF NOT EXISTS (
            SELECT 1 FROM public.restaurant_sauces
            WHERE id = selection_id::UUID
              AND restaurant_id = p_restaurant_id
              AND enabled = true
              AND CASE WHEN step_key = 'frites_sauce'
                THEN is_for_frites ELSE is_for_sandwich END
          ) THEN RETURN NULL; END IF;
        END LOOP;
        sauce_count := selection_count;
        IF step_key = 'frites_sauce' THEN
          unit_total := unit_total
            + greatest(0, sauce_count - config_free_frites_sauces) * config_extra_sauce;
        ELSE
          unit_total := unit_total
            + greatest(0, sauce_count - config_free_sauces) * config_extra_sauce;
        END IF;

      ELSIF step_key = 'frites' THEN
        IF selection_count > 1 THEN RETURN NULL; END IF;
        IF selection_count = 1 THEN
          selection := selections->0;
          SELECT option.value INTO canonical
          FROM public.cuisine_step_templates template,
            LATERAL jsonb_array_elements(coalesce(template.config->'options', '[]'::jsonb)) AS option(value)
          WHERE template.cuisine_type = restaurant_cuisine
            AND template.step_key = 'frites'
            AND option->>'id' = selection->>'id'
          LIMIT 1;
          IF canonical IS NULL THEN RETURN NULL; END IF;
          unit_total := unit_total + (canonical->>'price')::NUMERIC;
        END IF;

      ELSIF step_key IN ('supplement', 'boisson', 'dessert') THEN
        IF step_key IN ('boisson', 'dessert') AND selection_count > 1 THEN
          RETURN NULL;
        END IF;
        seen_ids := ARRAY[]::TEXT[];
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := split_part(selection->>'id', '__', 1);
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          SELECT price INTO canonical_price
          FROM public.menu_items
          WHERE id = selection_id::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true
            AND coalesce(is_alcohol, false) = false
            AND product_type = step_key;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + canonical_price;
        END LOOP;

      ELSIF step_key = 'accompagnement' THEN
        seen_ids := ARRAY[]::TEXT[];
        selection_count := 0;
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := selection->>'id';
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          selection_size := coalesce(selection#>>'{meta,size}', 'default');
          SELECT CASE selection_size
            WHEN 'small' THEN price_small
            WHEN 'medium' THEN price_medium
            WHEN 'large' THEN price_large
            ELSE price_default
          END
          INTO canonical_price
          FROM public.restaurant_accompagnements
          WHERE id = selection_id::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + coalesce(canonical_price, 0);
          IF selection_count >= config_free_accomp THEN
            unit_total := unit_total + config_extra_accomp;
          END IF;
          selection_count := selection_count + 1;
        END LOOP;

      ELSIF step_key = 'garniture' THEN
        seen_ids := ARRAY[]::TEXT[];
        FOR selection IN SELECT value FROM jsonb_array_elements(selections)
        LOOP
          selection_id := selection->>'id';
          IF selection_id = ANY(seen_ids) THEN RETURN NULL; END IF;
          seen_ids := array_append(seen_ids, selection_id);
          SELECT CASE WHEN selection#>>'{meta,level}' = 'x2'
            THEN price_x2 ELSE 0 END
          INTO canonical_price
          FROM public.restaurant_garnitures
          WHERE id = selection_id::UUID
            AND restaurant_id = p_restaurant_id
            AND enabled = true;
          IF NOT FOUND THEN RETURN NULL; END IF;
          unit_total := unit_total + coalesce(canonical_price, 0);
        END LOOP;
      ELSE
        RETURN NULL;
      END IF;
    END LOOP;

    -- Legacy/simple-item sauces are whitelisted by the menu item itself. The
    -- configurable flow already supplied canonical sauce UUIDs above.
    IF NOT has_custom_sauces AND jsonb_array_length(coalesce(item->'sauces', '[]'::jsonb)) > 0 THEN
      seen_ids := ARRAY[]::TEXT[];
      FOR selection IN SELECT value FROM jsonb_array_elements(item->'sauces')
      LOOP
        selection_name := trim(both '"' from selection::TEXT);
        IF selection_name = ANY(seen_ids)
          OR NOT selection_name = ANY(coalesce(item_row.sauces, ARRAY[]::TEXT[]))
        THEN RETURN NULL; END IF;
        seen_ids := array_append(seen_ids, selection_name);
      END LOOP;
      unit_total := unit_total
        + greatest(0, cardinality(seen_ids) - config_free_sauces) * config_extra_sauce;
    END IF;

    -- Legacy/simple-item supplements are matched by name and repriced from the
    -- menu item's own JSON catalogue.
    IF jsonb_array_length(coalesce(item->'supplements', '[]'::jsonb)) > 0 THEN
      seen_ids := ARRAY[]::TEXT[];
      FOR selection IN SELECT value FROM jsonb_array_elements(item->'supplements')
      LOOP
        selection_name := selection->>'name';
        IF selection_name = ANY(seen_ids) THEN RETURN NULL; END IF;
        seen_ids := array_append(seen_ids, selection_name);
        SELECT value INTO canonical
        FROM jsonb_array_elements(coalesce(item_row.supplements, '[]'::jsonb))
        WHERE value->>'name' = selection_name
        LIMIT 1;
        IF canonical IS NULL THEN RETURN NULL; END IF;
        unit_total := unit_total + (canonical->>'price')::NUMERIC;
      END LOOP;
    END IF;

    calculated_total := calculated_total + unit_total * quantity;
  END LOOP;

  RETURN round(calculated_total, 2);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- The UUID returned by this function is the high-entropy tracking capability.
-- Direct table INSERT/SELECT is not granted to anonymous users.
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
        customer_phone = left(coalesce(p_customer_phone, ''), 40)
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

CREATE OR REPLACE FUNCTION public.link_orders_to_user(
  p_user_id UUID,
  p_email TEXT,
  p_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  verified_email TEXT;
  verified_phone TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT email, phone
  INTO verified_email, verified_phone
  FROM auth.users
  WHERE id = auth.uid();

  IF (
    nullif(coalesce(verified_email, ''), '') IS NOT NULL
    AND nullif(trim(coalesce(p_email, '')), '') IS NOT NULL
    AND lower(trim(p_email)) <> lower(verified_email)
  ) OR (
    nullif(coalesce(verified_phone, ''), '') IS NOT NULL
    AND nullif(trim(coalesce(p_phone, '')), '') IS NOT NULL
    AND trim(p_phone) <> verified_phone
  ) THEN
    RAISE EXCEPTION 'identity_hint_mismatch' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET customer_user_id = auth.uid()
  WHERE customer_user_id IS NULL
    AND (
      (
        nullif(lower(coalesce(verified_email, '')), '') IS NOT NULL
        AND lower(customer_email) = lower(verified_email)
      )
      OR (
        nullif(coalesce(verified_phone, ''), '') IS NOT NULL
        AND customer_phone = verified_phone
      )
    );
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_referee
  ON public.referrals(referee_id)
  WHERE referee_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_referral_code(
  p_referee_restaurant_id UUID,
  p_ref_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id UUID;
BEGIN
  IF auth.uid() IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.restaurants
      WHERE id = p_referee_restaurant_id
        AND owner_id = auth.uid()
        AND referred_by IS NULL
    )
  THEN
    RETURN false;
  END IF;

  SELECT id
  INTO referrer_id
  FROM public.restaurants
  WHERE referral_code = upper(trim(p_ref_code))
    AND id <> p_referee_restaurant_id
  LIMIT 1;

  IF referrer_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.referrals (
    referrer_id,
    referee_id,
    status,
    bonus_weeks_granted,
    completed_at
  )
  VALUES (
    referrer_id,
    p_referee_restaurant_id,
    'completed',
    4,
    now()
  )
  ON CONFLICT (referee_id) WHERE referee_id IS NOT NULL DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.restaurants
  SET bonus_weeks = coalesce(bonus_weeks, 0) + 4
  WHERE id = referrer_id;

  UPDATE public.restaurants
  SET referred_by = referrer_id,
      trial_end_date = now() + interval '8 weeks',
      bonus_weeks = greatest(coalesce(bonus_weeks, 0), 4)
  WHERE id = p_referee_restaurant_id
    AND owner_id = auth.uid();

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- Explicit least-privilege API grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON
  public.menu_items,
  public.restaurant_hours,
  public.cuisine_step_templates,
  public.restaurant_bases,
  public.restaurant_viandes,
  public.restaurant_garnitures,
  public.restaurant_sauces,
  public.restaurant_accompagnements,
  public.restaurant_order_config,
  public.stock_photos
TO anon, authenticated;

GRANT INSERT ON public.page_views TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.restaurants,
  public.menu_items,
  public.restaurant_hours,
  public.restaurant_bases,
  public.restaurant_viandes,
  public.restaurant_garnitures,
  public.restaurant_sauces,
  public.restaurant_accompagnements,
  public.restaurant_order_config,
  public.restaurant_tablets,
  public.restaurant_customers,
  public.customer_profiles,
  public.stock_photos
TO authenticated;

GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT ON public.owners TO authenticated;
GRANT INSERT (id, email, phone) ON public.owners TO authenticated;
GRANT SELECT ON
  public.subscriptions,
  public.referrals,
  public.daily_order_counters,
  public.promo_codes,
  public.promo_code_uses,
  public.page_views
TO authenticated;
GRANT INSERT ON public.subscriptions TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_restaurant_by_slug(TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_restaurant_by_id(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_customer_ban(UUID, TEXT, TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, NUMERIC, NUMERIC,
  TEXT, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, BOOLEAN
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_for_tracking(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_order_count(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_deactivation_visits(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_demo_orders(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_demo_customers(UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_demo_restaurant(TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_demo_order(UUID, TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_orders_to_user(UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_code(UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin()
  TO authenticated;

-- Edge functions connect as service_role and require full backend access.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;
