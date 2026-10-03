\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(15);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('11000000-0000-4000-8000-000000000001','merchant@example.test',now()),
('11000000-0000-4000-8000-000000000002','customer@example.test',now()),
('11000000-0000-4000-8000-000000000003','other@example.test',now());
INSERT INTO owners(id,email,phone) VALUES('11000000-0000-4000-8000-000000000001','merchant@example.test','');
INSERT INTO restaurants(id,slug,name,owner_id,is_demo,is_open,is_accepting_orders,subscription_status)
VALUES('12000000-0000-4000-8000-000000000001','qa-paris','QA Paris','11000000-0000-4000-8000-000000000001',false,true,true,'active');
INSERT INTO menu_items(id,restaurant_id,name,price,category,product_type,enabled,is_alcohol)
VALUES('13000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','Pizza',12,'Pizzas','simple',true,false);
CREATE TEMP TABLE qa_payload AS SELECT jsonb_build_object('restaurant_id','12000000-0000-4000-8000-000000000001','customer_name','Client','customer_phone','0600000000','customer_email','customer@example.test','order_type','collect','items',jsonb_build_array(jsonb_build_object('menu_item_id','13000000-0000-4000-8000-000000000001','name','Pizza','quantity',1)),'subtotal',12,'total',12) payload;
SELECT set_config('request.jwt.claims','{}',true),set_config('request.jwt.claim.sub','',true);
SELECT extensions.throws_ok($$SELECT place_order('12000000-0000-4000-8000-000000000001','Client','0600000000','','collect','web',NULL,'[{"menu_item_id":"13000000-0000-4000-8000-000000000001","name":"Pizza","quantity":1}]',12,12,'',NULL,NULL,'cash',NULL,false)$$,'42501','authentication_required','real checkout requires confirmed account');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11000000-0000-4000-8000-000000000002"}',true),set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
SELECT extensions.ok(to_regprocedure('public.place_order_once(uuid,jsonb)') IS NOT NULL,'idempotent checkout RPC exists');
SELECT public.place_order_once('14000000-0000-4000-8000-000000000001',(SELECT payload FROM qa_payload));
SELECT public.place_order_once('14000000-0000-4000-8000-000000000001',(SELECT payload FROM qa_payload));
SELECT extensions.is((SELECT count(*)::int FROM orders WHERE restaurant_id='12000000-0000-4000-8000-000000000001'),1,'retry creates one order');
SELECT extensions.is((SELECT total_orders FROM restaurant_customers WHERE restaurant_id='12000000-0000-4000-8000-000000000001'),1,'retry does not double customer metrics');
SELECT extensions.is((SELECT customer_user_id::text FROM restaurant_customers WHERE restaurant_id='12000000-0000-4000-8000-000000000001'),'11000000-0000-4000-8000-000000000002','merchant customer is bound to account UID');
SELECT extensions.throws_ok($$SELECT place_order_once('14000000-0000-4000-8000-000000000001',(SELECT payload || '{"notes":"different"}'::jsonb FROM qa_payload))$$,'22023','order_request_conflict','changed retry payload refused');
SELECT extensions.throws_ok($$SELECT place_order_once('14000000-0000-4000-8000-000000000002',(SELECT payload || '{"total":1,"subtotal":1}'::jsonb FROM qa_payload))$$,'22023','invalid_total','server rejects forged price');
SELECT extensions.is(calculate_order_total('12000000-0000-4000-8000-000000000001','[{"menu_item_id":"13000000-0000-4000-8000-000000000001","quantity":1,"custom_choices":null,"supplements":null,"sauces":null}]'),12::numeric,'simple orders normalize absent choices without a config row');
UPDATE restaurant_customers SET is_banned=true WHERE restaurant_id='12000000-0000-4000-8000-000000000001';
SELECT extensions.throws_ok($$SELECT place_order_once('14000000-0000-4000-8000-000000000003',(SELECT payload || '{"customer_phone":"0700000000","customer_email":"changed@example.test"}'::jsonb FROM qa_payload))$$,'P0001','customer_banned','UID ban survives changed contact details');
SELECT extensions.is((SELECT count(*)::int FROM orders WHERE restaurant_id='12000000-0000-4000-8000-000000000001'),1,'refused submissions create no partial order');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11000000-0000-4000-8000-000000000003"}',true),set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
SELECT extensions.throws_ok($$SELECT place_order_once('14000000-0000-4000-8000-000000000001',(SELECT payload FROM qa_payload))$$,'22023','order_request_conflict','other account cannot replay another order capability');
SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT count(*)::int FROM orders WHERE restaurant_id='12000000-0000-4000-8000-000000000001'),0,'unrelated authenticated account cannot read merchant orders');
RESET ROLE;
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.order_requests','SELECT'),'request capabilities cannot be enumerated');
SELECT extensions.ok(NOT has_function_privilege('anon','public.place_order(uuid,text,text,text,text,text,integer,jsonb,numeric,numeric,text,text,timestamp with time zone,text,timestamp with time zone,boolean)','EXECUTE') AND NOT has_function_privilege('authenticated','public.place_order(uuid,text,text,text,text,text,integer,jsonb,numeric,numeric,text,text,timestamp with time zone,text,timestamp with time zone,boolean)','EXECUTE'),'direct order RPC cannot bypass idempotency');
SELECT extensions.ok(has_function_privilege('authenticated','public.place_order_once(uuid,jsonb)','EXECUTE'),'authenticated checkout can use the idempotent wrapper');
SELECT * FROM extensions.finish();
ROLLBACK;
