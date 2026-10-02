\set ON_ERROR_STOP on
\echo '1..1'

BEGIN;

INSERT INTO public.restaurants (
  id, slug, name, is_demo, is_open, is_accepting_orders
)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'security-test-private',
  'Security Test Private',
  TRUE,
  TRUE,
  TRUE
);

INSERT INTO public.menu_items (
  id,
  restaurant_id,
  name,
  price,
  category,
  enabled,
  is_alcohol
)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Security Test Item',
  10,
  'Tests',
  TRUE,
  FALSE
);

INSERT INTO public.menu_items (
  id,
  restaurant_id,
  name,
  price,
  category,
  product_type,
  enabled,
  is_alcohol
)
VALUES (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'Security Test Supplement',
  2,
  'Tests',
  'supplement',
  TRUE,
  FALSE
);

INSERT INTO public.orders (
  id,
  restaurant_id,
  customer_name,
  customer_phone,
  customer_email,
  order_type,
  items,
  subtotal,
  total
)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Private Customer',
  '0600000000',
  'private@example.test',
  'collect',
  '[{"menu_item_id":"30000000-0000-4000-8000-000000000001","name":"Security Test Item","quantity":1,"supplements":[],"extra_cost":0}]'::jsonb,
  10,
  10
);

INSERT INTO public.email_logs (email_type, recipient_email)
VALUES ('security_test', 'private@example.test');

INSERT INTO public.prospection_events (resend_id, email, event_type)
VALUES ('security-test-event', 'private@example.test', 'delivered');

SET LOCAL ROLE anon;

DO $$
DECLARE
  payload JSONB;
  menu_count INTEGER;
  created_id UUID;
  denied BOOLEAN;
BEGIN
  SELECT public.get_public_restaurant_by_slug('security-test-private')
  INTO payload;
  IF payload IS NULL OR payload->>'name' <> 'Security Test Private' THEN
    RAISE EXCEPTION 'public restaurant RPC is not usable';
  END IF;
  IF payload ? 'owner_id' OR payload ? 'stripe_customer_id' THEN
    RAISE EXCEPTION 'public restaurant RPC leaks private identifiers';
  END IF;

  SELECT count(*)
  INTO menu_count
  FROM public.menu_items
  WHERE restaurant_id = '10000000-0000-4000-8000-000000000001';
  IF menu_count <> 2 THEN
    RAISE EXCEPTION 'public menu catalogue is not readable';
  END IF;

  denied := false;
  BEGIN
    PERFORM 1 FROM public.restaurants LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'anon has direct access to the restaurants table';
  END IF;

  denied := false;
  BEGIN
    PERFORM 1 FROM public.orders
    WHERE id = '20000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'anon can read private orders directly';
  END IF;

  denied := false;
  BEGIN
    INSERT INTO public.orders (
      restaurant_id,
      customer_name,
      customer_phone,
      order_type,
      items,
      subtotal,
      total
    )
    VALUES (
      '10000000-0000-4000-8000-000000000001',
      'Bypass',
      '0611111111',
      'collect',
      '[]'::jsonb,
      0,
      0
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'anon can bypass place_order with a direct insert';
  END IF;

  denied := false;
  BEGIN
    PERFORM 1 FROM public.email_logs LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'anon can read service-only email logs';
  END IF;

  denied := false;
  BEGIN
    PERFORM 1 FROM public.prospection_events LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'anon can read service-only prospection data';
  END IF;

  SELECT (public.place_order(
    '10000000-0000-4000-8000-000000000001',
    'RPC Customer',
    '0622222222',
    'rpc@example.test',
    'collect',
    'web',
    NULL,
    '[{"menu_item_id":"30000000-0000-4000-8000-000000000001","name":"Security Test Item","quantity":1,"supplements":[],"extra_cost":0}]'::jsonb,
    10,
    10,
    '',
    NULL,
    NULL,
    'cash',
    NULL,
    FALSE
  )).id
  INTO created_id;

  IF created_id IS NULL THEN
    RAISE EXCEPTION 'place_order did not return a tracking capability';
  END IF;

  denied := false;
  BEGIN
    PERFORM public.place_order(
      '10000000-0000-4000-8000-000000000001',
      'Tampered Price',
      '0633333333',
      'tampered@example.test',
      'collect',
      'web',
      NULL,
      '[{"menu_item_id":"30000000-0000-4000-8000-000000000001","name":"Security Test Item","quantity":1,"supplements":[],"extra_cost":0,"custom_choices":[{"stepKey":"supplement","selections":[{"id":"30000000-0000-4000-8000-000000000002","name":"Security Test Supplement","price":0}]}]}]'::jsonb,
      10,
      10,
      '',
      NULL,
      NULL,
      'cash',
      NULL,
      FALSE
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'anon can understate canonical configurator prices';
  END IF;
END
$$;

RESET ROLE;

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-one@example.test', '',
    now(), now(), now(), '', '', '', ''
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'owner-two@example.test', '',
    now(), now(), now(), '', '', '', ''
  );

INSERT INTO public.owners (id, email, phone, role)
VALUES
  ('40000000-0000-4000-8000-000000000001', 'owner-one@example.test', '0600000001', 'owner'),
  ('40000000-0000-4000-8000-000000000002', 'owner-two@example.test', '0600000002', 'owner');

INSERT INTO public.restaurants (
  id, owner_id, slug, name, is_open, is_accepting_orders, subscription_status
)
VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'tenant-one', 'Tenant One', true, true, 'trial'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'tenant-two', 'Tenant Two', true, true, 'trial'
  );

INSERT INTO public.orders (
  restaurant_id, customer_name, customer_phone, order_type, items, subtotal, total
)
VALUES (
  '50000000-0000-4000-8000-000000000002',
  'Tenant Two Customer', '0644444444', 'collect', '[]'::jsonb, 0, 0
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  visible_count INTEGER;
  affected_count INTEGER;
  denied BOOLEAN;
BEGIN
  SELECT count(*) INTO visible_count FROM public.restaurants;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'authenticated tenant can enumerate restaurants';
  END IF;

  SELECT count(*) INTO visible_count FROM public.orders
  WHERE restaurant_id = '50000000-0000-4000-8000-000000000002';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'authenticated tenant can read another tenant orders';
  END IF;

  UPDATE public.restaurants SET name = 'Cross tenant mutation'
  WHERE id = '50000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 0 THEN
    RAISE EXCEPTION 'authenticated tenant can update another restaurant';
  END IF;

  denied := false;
  BEGIN
    UPDATE public.owners SET role = 'super_admin'
    WHERE id = '40000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'owner can self-promote to super_admin';
  END IF;

  denied := false;
  BEGIN
    INSERT INTO public.restaurants (owner_id, slug, name)
    VALUES (
      '40000000-0000-4000-8000-000000000002',
      'forged-owner',
      'Forged owner restaurant'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'owner can create a restaurant for another identity';
  END IF;

  INSERT INTO public.subscriptions (restaurant_id, status, plan)
  VALUES ('50000000-0000-4000-8000-000000000001', 'trial', 'monthly');

  denied := false;
  BEGIN
    INSERT INTO public.subscriptions (restaurant_id, status, plan)
    VALUES ('50000000-0000-4000-8000-000000000001', 'active', 'monthly');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'owner can forge an active subscription';
  END IF;
END
$$;

RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.grant_referral_bonus(uuid,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute grant_referral_bonus';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.cleanup_demo_orders()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute cleanup_demo_orders';
  END IF;
END
$$;

ROLLBACK;

\echo 'ok 1 - least-privilege RLS and anonymous order RPC'
