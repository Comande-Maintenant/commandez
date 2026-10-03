\set ON_ERROR_STOP on
-- Isolated PostgreSQL only. Every fixture and temporary demo change rolls back.
-- No order, account, provider, seed replay or external request is created.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(22);

SELECT extensions.is((SELECT count(*)::int FROM public.restaurants
  WHERE slug='antalya-kebab-moneteau' AND is_demo IS TRUE),1,
  'canonical demonstration exists in the historical seed');

INSERT INTO public.restaurants(id,name,slug,is_demo,is_open,is_accepting_orders)
VALUES
  ('19000000-0000-4000-8000-000000000001','QA ordinary restaurant','qa-canonical-ordinary',false,true,true),
  ('19000000-0000-4000-8000-000000000002','QA other demonstration','qa-canonical-other',true,true,true);

SELECT extensions.is((SELECT id::text FROM public.get_demo_restaurant('demo')),
  '769f54f9-09a6-40a9-a490-26597a717646','owner alias resolves the canonical demonstration');
SELECT extensions.is(public.get_public_restaurant_by_slug('demo')->>'id',
  '769f54f9-09a6-40a9-a490-26597a717646','public alias resolves the same canonical demonstration');
SELECT extensions.is((SELECT id::text FROM public.get_demo_restaurant('antalya-kebab-moneteau')),
  '769f54f9-09a6-40a9-a490-26597a717646','explicit owner canonical slug remains valid');
SELECT extensions.is(public.get_public_restaurant_by_slug('antalya-kebab-moneteau')->>'id',
  '769f54f9-09a6-40a9-a490-26597a717646','explicit public canonical slug remains valid');
SELECT extensions.is(public.get_public_restaurant_by_slug('demo')->>'name',
  (SELECT name FROM public.get_demo_restaurant('demo')),'owner and public aliases agree on identity');
SELECT extensions.ok(NOT (public.get_public_restaurant_by_slug('demo') ? 'owner_id'),
  'public alias retains the restricted public payload');
SELECT extensions.is(public.get_public_restaurant_by_slug('qa-canonical-ordinary')->>'id',
  '19000000-0000-4000-8000-000000000001','ordinary public merchant lookup stays unchanged');
SELECT extensions.is((SELECT count(*)::int FROM public.get_demo_restaurant('qa-canonical-ordinary')),0,
  'owner demonstration lookup never returns an ordinary merchant');
SELECT extensions.is((SELECT id::text FROM public.get_demo_restaurant('qa-canonical-other')),
  '19000000-0000-4000-8000-000000000002','explicit other demonstration lookup stays unchanged');
SELECT extensions.is(public.get_public_restaurant_by_slug('qa-canonical-other')->>'id',
  '19000000-0000-4000-8000-000000000002','explicit other public demonstration stays unchanged');
SELECT extensions.is((SELECT count(*)::int FROM public.get_demo_restaurant(NULL::text)),0,
  'null owner slug has no match');
SELECT extensions.ok(public.get_public_restaurant_by_slug(NULL::text) IS NULL,
  'null public slug has no match');

SET LOCAL ROLE anon;
SELECT extensions.is((SELECT id::text FROM public.get_demo_restaurant('demo')),
  '769f54f9-09a6-40a9-a490-26597a717646','anonymous owner demo access is preserved');
SELECT extensions.is(public.get_public_restaurant_by_slug('demo')->>'id',
  '769f54f9-09a6-40a9-a490-26597a717646','anonymous public demo access is preserved');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT id::text FROM public.get_demo_restaurant('demo')),
  '769f54f9-09a6-40a9-a490-26597a717646','authenticated owner demo access is preserved');
SELECT extensions.is(public.get_public_restaurant_by_slug('demo')->>'id',
  '769f54f9-09a6-40a9-a490-26597a717646','authenticated public demo access is preserved');
RESET ROLE;

-- A canonical slug reassigned to a real merchant must never become a demo.
UPDATE public.restaurants SET is_demo=false WHERE slug='antalya-kebab-moneteau';
SELECT extensions.is((SELECT count(*)::int FROM public.get_demo_restaurant('demo')),0,
  'owner alias fails closed when the canonical row is not a demonstration');
SELECT extensions.ok(public.get_public_restaurant_by_slug('demo') IS NULL,
  'public alias fails closed when the canonical row is not a demonstration');
SELECT extensions.is(public.get_public_restaurant_by_slug('antalya-kebab-moneteau')->>'id',
  '769f54f9-09a6-40a9-a490-26597a717646','ordinary direct public slug keeps its original contract');

-- Keep all rows; temporarily hide only the canonical slug to test no fallback.
UPDATE public.restaurants SET slug='qa-canonical-hidden',is_demo=true
  WHERE slug='antalya-kebab-moneteau';
SELECT extensions.is((SELECT count(*)::int FROM public.get_demo_restaurant('demo')),0,
  'missing canonical demo never falls back to another demo or its activity');
SELECT extensions.ok(public.get_public_restaurant_by_slug('demo') IS NULL,
  'missing canonical public demo never falls back to the legacy demo row');

SELECT * FROM extensions.finish();
ROLLBACK;
