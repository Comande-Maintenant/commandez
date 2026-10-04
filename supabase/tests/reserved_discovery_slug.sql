\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(20);
INSERT INTO auth.users(id,email,email_confirmed_at)
 VALUES('21300000-0000-4000-8000-000000000001','qa-discovery-pgtap@example.test',now());
SELECT set_config('request.jwt.claim.sub','21300000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"21300000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok($$SELECT complete_onboarding('21300000-0000-4000-8000-000000000002',
 '{"name":"Discovery","slug":"decouvrir","city":"Paris"}','[]','{}')$$,
 '22023','invalid_slug','onboarding rejects the application route before creating records');
RESET ROLE;
SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE owner_id='21300000-0000-4000-8000-000000000001'),0,'no partial restaurant');
SELECT extensions.is((SELECT count(*)::int FROM owners WHERE id='21300000-0000-4000-8000-000000000001'),0,'no partial owner');
SELECT extensions.is((SELECT count(*)::int FROM subscriptions s JOIN restaurants r ON r.id=s.restaurant_id WHERE r.owner_id='21300000-0000-4000-8000-000000000001'),0,'no partial subscription');
-- Keep a failing baseline independent from the direct INSERT/UPDATE checks.
DELETE FROM restaurants WHERE owner_id='21300000-0000-4000-8000-000000000001';
DELETE FROM owners WHERE id='21300000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT complete_onboarding('21300000-0000-4000-8000-000000000003',
 '{"name":"Discovery","slug":"decouvrir-paris","city":"Paris"}',
 '[{"name":"Pizza","category":"Plats","price":12}]','{}');
SELECT extensions.is((SELECT complete_onboarding('21300000-0000-4000-8000-000000000003',
 '{"name":"Replay","slug":"decouvrir-paris"}','[]','{}')->>'created'),'false','normal onboarding remains idempotent');
SELECT extensions.throws_ok($$INSERT INTO restaurants(name,slug,owner_id) VALUES
 ('Reserved','decouvrir','21300000-0000-4000-8000-000000000001')$$,'23514',NULL,'direct owner INSERT cannot reserve the route');
SELECT extensions.throws_ok($$INSERT INTO restaurants(name,slug,owner_id) VALUES
 ('Reserved uppercase','DECOUVRIR','21300000-0000-4000-8000-000000000001')$$,'23514',NULL,'direct INSERT cannot bypass the case-insensitive route');
SELECT extensions.throws_ok($$UPDATE restaurants SET slug='Decouvrir'
 WHERE onboarding_key='21300000-0000-4000-8000-000000000003'$$,'23514',NULL,'direct owner UPDATE cannot reserve the route');
RESET ROLE;
SELECT extensions.is((SELECT slug FROM restaurants WHERE onboarding_key='21300000-0000-4000-8000-000000000003'),'decouvrir-paris','rejected update preserves the published slug');
SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE onboarding_key='21300000-0000-4000-8000-000000000003'),1,'replay preserves one establishment');
SELECT extensions.is((SELECT count(*)::int FROM menu_items WHERE restaurant_id=(SELECT id FROM restaurants WHERE onboarding_key='21300000-0000-4000-8000-000000000003')),1,'replay preserves the original menu');
SELECT extensions.is((SELECT subscription_status FROM restaurants WHERE onboarding_key='21300000-0000-4000-8000-000000000003'),'free','ordinary publication remains free');
SELECT extensions.ok((SELECT trial_end_date IS NULL FROM restaurants WHERE onboarding_key='21300000-0000-4000-8000-000000000003'),'no restaurant trial deadline');
SELECT extensions.is((SELECT count(*)::int FROM subscriptions WHERE restaurant_id=(SELECT id FROM restaurants WHERE onboarding_key='21300000-0000-4000-8000-000000000003') AND status='free' AND trial_end IS NULL),1,'one free subscription without expiration');
SELECT extensions.ok(NOT has_function_privilege('anon','public.complete_onboarding(uuid,jsonb,jsonb,jsonb)','EXECUTE'),'anonymous onboarding remains denied');
SELECT extensions.ok(has_function_privilege('authenticated','public.complete_onboarding(uuid,jsonb,jsonb,jsonb)','EXECUTE'),'authenticated onboarding remains available');
SELECT extensions.is((SELECT slug FROM get_demo_restaurant('demo')),'antalya-kebab-moneteau','canonical demo remains available');
SELECT extensions.is((get_public_restaurant_by_slug('demo')->>'slug'),'antalya-kebab-moneteau','public canonical demo remains available');
SELECT extensions.throws_ok($$INSERT INTO restaurants(name,slug,is_demo) VALUES
 ('Privileged reserved','decouvrir',true)$$,'23514',NULL,'privileged writes cannot shadow the application route');
SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE lower(slug)='decouvrir'),0,'no case variant shadows discovery');
SELECT * FROM extensions.finish();
ROLLBACK;
