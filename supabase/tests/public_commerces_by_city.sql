BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(30);
-- These fixtures must run only against an isolated PostgreSQL test database.
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('95000000-0000-0000-0000-000000000001','city-directory@example.test',now());
SELECT set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000001',true);
DO $$
DECLARE kind TEXT; key UUID; n INT:=0;
BEGIN
  FOREACH kind IN ARRAY ARRAY['public','closed','demo','prospect','suspended','archived','deactivated','deletion','empty','disabled','alcohol','null-alcohol','null-enabled','ownerless','other-city','apostrophe'] LOOP
    n:=n+1; key:=('95000000-0000-0000-0000-' || lpad((100+n)::text,12,'0'))::uuid;
    PERFORM public.complete_onboarding(key,jsonb_build_object('name','Directory ' || kind,'slug','directory-fixture-' || kind,'city',CASE WHEN kind='other-city' THEN 'Paris' WHEN kind='apostrophe' THEN 'L’Haÿ-les-Roses' ELSE 'Évreux' END),
      CASE WHEN kind='empty' THEN '[]'::jsonb ELSE '[{"name":"Test item","category":"Test","price":12}]'::jsonb END,'{}');
  END LOOP;
END $$;
UPDATE public.restaurants SET is_open=false,is_accepting_orders=false WHERE slug='directory-fixture-closed';
UPDATE public.restaurants SET is_demo=true WHERE slug='directory-fixture-demo';
UPDATE public.restaurants SET account_status=substring(slug from 'directory-fixture-(.*)') WHERE slug IN ('directory-fixture-prospect','directory-fixture-suspended','directory-fixture-archived');
UPDATE public.restaurants SET deactivated_at=now() WHERE slug='directory-fixture-deactivated';
UPDATE public.restaurants SET scheduled_deletion_at=now() WHERE slug='directory-fixture-deletion';
UPDATE public.restaurants SET owner_id=NULL WHERE slug='directory-fixture-ownerless';
UPDATE public.menu_items SET enabled=false WHERE restaurant_id=(SELECT id FROM restaurants WHERE slug='directory-fixture-disabled');
UPDATE public.menu_items SET is_alcohol=true WHERE restaurant_id=(SELECT id FROM restaurants WHERE slug='directory-fixture-alcohol');
UPDATE public.menu_items SET is_alcohol=NULL WHERE restaurant_id=(SELECT id FROM restaurants WHERE slug='directory-fixture-null-alcohol');
UPDATE public.menu_items SET enabled=NULL WHERE restaurant_id=(SELECT id FROM restaurants WHERE slug='directory-fixture-null-enabled');
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city('Évreux')->'items'),2,'only active owned non-demo pages with client-visible items are listed');
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city('  EvReUx  ')->'items'),2,'case, spaces and omitted accents match the published city');
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city(U&'E\0301vreux')->'items'),2,'decomposed Unicode city is normalized');
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city('Paris')->'items'),1,'exact city match excludes other cities');
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city('L''Hay-les-Roses')->'items'),1,'curly and straight apostrophes and omitted accents match');
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city('Saint  Pierre')->'items'),0,'valid empty city is a successful empty result');
SELECT extensions.is((public.list_public_commerces_by_city('Évreux')->>'has_more')::boolean,false,'partial flag is false for a complete small response');
SELECT extensions.is((SELECT count(*)::int FROM jsonb_object_keys(public.list_public_commerces_by_city('Évreux'))),2,'envelope only contains items and has_more');
SELECT extensions.is((SELECT count(*)::int FROM jsonb_object_keys(public.list_public_commerces_by_city('Évreux')->'items'->0)),8,'row projection contains exactly eight public fields');
SELECT extensions.is((SELECT array_agg(k ORDER BY k)::text FROM jsonb_object_keys(public.list_public_commerces_by_city('Évreux')->'items'->0) k),'{business_type,city,cover_image,cuisine,cuisine_type,image,name,slug}','row field allowlist excludes owner, contact, config and orders');
SELECT extensions.ok(EXISTS(SELECT FROM jsonb_array_elements(public.list_public_commerces_by_city('Évreux')->'items') row WHERE row->>'slug'='directory-fixture-closed'),'temporarily closed commerce remains browseable');
SELECT extensions.ok(NOT EXISTS(SELECT FROM jsonb_array_elements(public.list_public_commerces_by_city('Évreux')->'items') row WHERE row->>'slug' IN ('directory-fixture-null-alcohol','directory-fixture-alcohol','directory-fixture-disabled','directory-fixture-empty','directory-fixture-null-enabled')),'unrenderable menus excluded, including nullable flags');
SELECT extensions.throws_ok($$SELECT public.list_public_commerces_by_city(NULL)$$,'22023','invalid_city','null cannot become a national search');
SELECT extensions.throws_ok($$SELECT public.list_public_commerces_by_city('')$$,'22023','invalid_city','empty cannot become a national search');
SELECT extensions.throws_ok($$SELECT public.list_public_commerces_by_city('   ')$$,'22023','invalid_city','whitespace is rejected');
SELECT extensions.throws_ok($$SELECT public.list_public_commerces_by_city(repeat('x',81))$$,'22023','invalid_city','city is bounded to 80 characters');
SELECT extensions.throws_ok($$SELECT public.list_public_commerces_by_city('Paris%')$$,'22023','invalid_city','wildcard input is rejected');
SELECT extensions.throws_ok($$SELECT public.list_public_commerces_by_city(E'Paris\nAuxerre')$$,'22023','invalid_city','control characters are rejected');
SELECT extensions.throws_ok($q$SELECT public.list_public_commerces_by_city('x'');DROP TABLE restaurants;--')$q$,'22023','invalid_city','query syntax is never interpolated');
SELECT extensions.ok(has_function_privilege('anon','public.list_public_commerces_by_city(text)','EXECUTE'),'anonymous execution is granted');
SELECT extensions.ok(has_function_privilege('authenticated','public.list_public_commerces_by_city(text)','EXECUTE'),'authenticated execution is granted');
SELECT extensions.ok((SELECT prosecdef FROM pg_proc WHERE oid='public.list_public_commerces_by_city(text)'::regprocedure),'RPC is SECURITY DEFINER');
SELECT extensions.is((SELECT proconfig[1] FROM pg_proc WHERE oid='public.list_public_commerces_by_city(text)'::regprocedure),'search_path=pg_catalog, public','fixed trusted search path');
SET LOCAL ROLE anon;
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city('Evreux')->'items'),2,'actual anonymous call returns public projection');
RESET ROLE;
SELECT extensions.is((SELECT count(*)::int FROM jsonb_object_keys((SELECT to_jsonb(p) FROM public.list_public_restaurants() p WHERE slug='directory-fixture-public'))),2,'existing sitemap projection remains unchanged');
DO $$
DECLARE n INT;
BEGIN
  FOR n IN 1..101 LOOP
    PERFORM public.complete_onboarding(('95000000-0000-0000-0000-' || lpad((1000+n)::text,12,'0'))::uuid,
      jsonb_build_object('name','Bound ' || lpad(n::text,3,'0'),'slug','directory-bound-' || n,'city','Directory Bound'),
      '[{"name":"Test item","category":"Test","price":12}]'::jsonb,'{}');
  END LOOP;
END $$;
SELECT extensions.is(jsonb_array_length(public.list_public_commerces_by_city('Directory Bound')->'items'),100,'at most 100 shops are returned');
SELECT extensions.is((public.list_public_commerces_by_city('Directory Bound')->>'has_more')::boolean,true,'partial results are explicit rather than silently truncated');
SELECT extensions.is(public.list_public_commerces_by_city('Directory Bound')->'items'->0->>'name','Bound 001','results sort by name');
SELECT extensions.is(public.list_public_commerces_by_city('Directory Bound')->'items'->99->>'name','Bound 100','deterministic page boundary');
SELECT extensions.ok(NOT EXISTS(SELECT FROM jsonb_array_elements(public.list_public_commerces_by_city('Directory Bound')->'items') row WHERE row ?| ARRAY['owner_id','restaurant_phone','customization_config','email']),'entire bounded response has no private fields');
SELECT * FROM extensions.finish();
ROLLBACK;
