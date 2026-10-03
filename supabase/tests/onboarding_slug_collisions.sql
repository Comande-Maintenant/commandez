\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(8);
INSERT INTO auth.users(id,email,email_confirmed_at)
 VALUES('16100000-0000-4000-8000-000000000001','qa-overlap-pgtap@example.test',now());
INSERT INTO owners(id,email,phone)
 VALUES('16100000-0000-4000-8000-000000000001','qa-overlap-pgtap@example.test','');
INSERT INTO restaurants(name,slug,owner_id) VALUES
 ('QA Overlap Seed','qa-overlap-pgtap','16100000-0000-4000-8000-000000000001'),
 ('QA Overlap Seed 2','qa-overlap-pgtap-2','16100000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claim.sub','16100000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"16100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT complete_onboarding('16200000-0000-4000-8000-000000000001',
 '{"name":"QA Overlap","slug":"qa-overlap-pgtap","city":"Paris"}',
 '[{"name":"Pizza","category":"Plats","price":12}]','{}');
SELECT complete_onboarding('16200000-0000-4000-8000-000000000002',
 '{"name":"QA Overlap 2","slug":"qa-overlap-pgtap-2","owner_id":"00000000-0000-4000-8000-000000000001"}',
 '[{"name":"Pizza","category":"Plats","price":12}]','{}');
RESET ROLE;
SELECT extensions.is((SELECT slug FROM restaurants WHERE onboarding_key='16200000-0000-4000-8000-000000000001'),'qa-overlap-pgtap-3','existing suffixes are skipped');
SELECT extensions.is((SELECT slug FROM restaurants WHERE onboarding_key='16200000-0000-4000-8000-000000000002'),'qa-overlap-pgtap-2-2','overlapping base gets its own available suffix');
SELECT extensions.is((SELECT owner_id::text FROM restaurants WHERE onboarding_key='16200000-0000-4000-8000-000000000002'),'16100000-0000-4000-8000-000000000001','owner is derived from confirmed session');
SELECT extensions.is((SELECT count(*)::int FROM subscriptions WHERE restaurant_id IN (SELECT id FROM restaurants WHERE onboarding_key IN ('16200000-0000-4000-8000-000000000001','16200000-0000-4000-8000-000000000002')) AND status='free'),2,'both suffix creations retain free access');
SELECT extensions.is((SELECT complete_onboarding('16200000-0000-4000-8000-000000000001','{"name":"Replay","slug":"qa-overlap-replay"}','[]','{}')->>'created'),'false','idempotent replay returns the original restaurant');
SELECT extensions.is((SELECT count(*)::int FROM menu_items WHERE restaurant_id IN (SELECT id FROM restaurants WHERE onboarding_key IN ('16200000-0000-4000-8000-000000000001','16200000-0000-4000-8000-000000000002'))),2,'retry does not duplicate menu items');
SELECT extensions.ok(NOT has_function_privilege('anon','public.complete_onboarding(uuid,jsonb,jsonb,jsonb)','EXECUTE'),'anonymous onboarding is denied');
SELECT extensions.ok(has_function_privilege('authenticated','public.complete_onboarding(uuid,jsonb,jsonb,jsonb)','EXECUTE'),'authenticated onboarding remains available');
SELECT * FROM extensions.finish();
ROLLBACK;
