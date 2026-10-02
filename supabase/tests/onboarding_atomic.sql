BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(10);
INSERT INTO auth.users (id,email,email_confirmed_at) VALUES
('10000000-0000-0000-0000-000000000001','owner1@example.test',now()),
('10000000-0000-0000-0000-000000000002','owner2@example.test',now());
SELECT set_config('request.jwt.claims','{}',true);
SELECT extensions.throws_ok($$SELECT public.complete_onboarding('20000000-0000-0000-0000-000000000001','{"name":"Atomic Restaurant","slug":"atomic"}','[]','{}')$$, '42501', 'authentication_required', 'anonymous creation refused');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SELECT public.complete_onboarding('20000000-0000-0000-0000-000000000001','{"name":"Atomic Restaurant","slug":"atomic","city":"Paris"}','[{"name":"Pizza","category":"Pizzas","price":12,"product_type":"simple"}]','{}');
SELECT extensions.is((SELECT count(*)::int FROM public.restaurants WHERE slug='atomic'),1,'restaurant created');
SELECT public.complete_onboarding('20000000-0000-0000-0000-000000000001','{"name":"Atomic Restaurant","slug":"atomic"}','[]','{}');
SELECT extensions.is((SELECT count(*)::int FROM public.restaurants WHERE onboarding_key='20000000-0000-0000-0000-000000000001'),1,'retry does not duplicate');
SELECT extensions.is((SELECT count(*)::int FROM public.menu_items WHERE restaurant_id=(SELECT id FROM restaurants WHERE slug='atomic')),1,'retry preserves original menu');
SELECT extensions.is((SELECT round(extract(epoch FROM trial_end-trial_start)/86400)::int FROM subscriptions WHERE restaurant_id=(SELECT id FROM restaurants WHERE slug='atomic')),30,'trial lasts thirty days');
SELECT extensions.throws_ok($$SELECT public.complete_onboarding('20000000-0000-0000-0000-000000000003','{"name":"Broken","slug":"broken"}','[{"name":"Bad","category":"Main","price":-5}]','{}')$$,'22023','invalid_menu','invalid menu rolls back creation');
SELECT extensions.is((SELECT count(*)::int FROM public.restaurants WHERE slug='broken'),0,'no partial restaurant remains');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.complete_onboarding('20000000-0000-0000-0000-000000000001','{"name":"Other owner","slug":"atomic","owner_id":"10000000-0000-0000-0000-000000000001"}','[]','{}');
RESET ROLE;
SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE onboarding_key='20000000-0000-0000-0000-000000000001'),2,'creation key is scoped to each owner');
SELECT extensions.is((SELECT owner_id::text FROM restaurants WHERE slug='atomic-2'),'10000000-0000-0000-0000-000000000002','forged owner field ignored');
SELECT extensions.is((SELECT owner_id::text FROM restaurants WHERE slug='atomic'),'10000000-0000-0000-0000-000000000001','original restaurant unchanged');
SELECT * FROM extensions.finish();
ROLLBACK;
