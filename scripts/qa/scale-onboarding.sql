BEGIN;
SELECT set_config('request.jwt.claim.sub',md5('scaleowner-' || :client_id)::uuid::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',md5('scaleowner-' || :client_id)::uuid::text,'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT public.complete_onboarding(md5('scale-onboarding-' || :client_id)::uuid,
 '{"name":"Scale Kebab","city":"Paris","slug":"scale-kebab-paris"}',
 '[{"name":"Pizza","category":"Pizzas","product_type":"simple","price":12}]','{}');
COMMIT;
