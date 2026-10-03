\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('15000000-0000-4000-8000-000000000001','free@example.test',now());
SELECT set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}',true),set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
SELECT complete_onboarding('15000000-0000-4000-8000-000000000002','{"name":"Free Restaurant","city":"Paris","slug":"free-restaurant-paris"}','[{"name":"Pizza","category":"Pizza","price":12,"product_type":"simple"}]','{}');
SELECT extensions.is((SELECT subscription_status FROM restaurants WHERE slug='free-restaurant-paris'),'free','new establishment has free access');
SELECT extensions.ok((SELECT trial_end_date IS NULL FROM restaurants WHERE slug='free-restaurant-paris'),'no artificial trial expiry');
SELECT extensions.is((SELECT status FROM subscriptions WHERE restaurant_id=(SELECT id FROM restaurants WHERE slug='free-restaurant-paris')),'free','billing record does not activate an unpaid subscription');
UPDATE restaurants SET subscription_status='expired',trial_end_date=now()-interval '10 days' WHERE slug='free-restaurant-paris';
SELECT extensions.lives_ok($$SELECT place_order_once('15000000-0000-4000-8000-000000000003',(SELECT jsonb_build_object('restaurant_id',r.id,'customer_name','Free Client','customer_phone','0600000000','order_type','collect','items',jsonb_build_array(jsonb_build_object('menu_item_id',m.id,'name','Pizza','quantity',1)),'subtotal',12,'total',12) FROM restaurants r JOIN menu_items m ON m.restaurant_id=r.id WHERE r.slug='free-restaurant-paris'))$$,'legacy billing status never blocks currently free ordering');
SELECT * FROM extensions.finish();
ROLLBACK;
