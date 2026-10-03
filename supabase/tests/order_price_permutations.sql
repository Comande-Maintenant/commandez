\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(6);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('16300000-0000-4000-8000-000000000001','qa-overlap-price-owner@example.test',now()),
 ('16300000-0000-4000-8000-000000000002','qa-overlap-price-client@example.test',now());
INSERT INTO owners(id,email,phone) VALUES('16300000-0000-4000-8000-000000000001','qa-overlap-price-owner@example.test','');
INSERT INTO restaurants(id,name,slug,owner_id,is_open,is_accepting_orders,cuisine_type)
 VALUES('16400000-0000-4000-8000-000000000001','QA Overlap Price','qa-overlap-price','16300000-0000-4000-8000-000000000001',true,true,'generic');
INSERT INTO menu_items(id,restaurant_id,name,price,category,product_type,enabled,is_alcohol) VALUES
 ('16500000-0000-4000-8000-000000000001','16400000-0000-4000-8000-000000000001','Sandwich',10,'Plats','sandwich_personnalisable',true,false),
 ('16500000-0000-4000-8000-000000000002','16400000-0000-4000-8000-000000000001','Boisson',3,'Boissons','boisson',true,false);
INSERT INTO restaurant_bases(id,restaurant_id,name,price,"group",enabled)
 VALUES('16600000-0000-4000-8000-000000000001','16400000-0000-4000-8000-000000000001','Pain',10,'sandwich_personnalisable',true);
SELECT set_config('request.jwt.claim.sub','16300000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"16300000-0000-4000-8000-000000000002","role":"authenticated"}',true);
CREATE TEMP TABLE review_items AS SELECT
 '[{"menu_item_id":"16500000-0000-4000-8000-000000000001","name":"Sandwich","quantity":1,"custom_choices":[{"stepKey":"base","selections":[{"id":"16600000-0000-4000-8000-000000000001"}]},{"stepKey":"boisson","selections":[{"id":"16500000-0000-4000-8000-000000000002"}]}]}]'::jsonb normal,
 '[{"menu_item_id":"16500000-0000-4000-8000-000000000001","name":"Sandwich","quantity":1,"custom_choices":[{"stepKey":"boisson","selections":[{"id":"16500000-0000-4000-8000-000000000002"}]},{"stepKey":"base","selections":[{"id":"16600000-0000-4000-8000-000000000001"}]}]}]'::jsonb reordered;
SELECT extensions.is(calculate_order_total('16400000-0000-4000-8000-000000000001',normal),13::numeric,'base then extra uses canonical prices') FROM review_items;
SELECT extensions.is(calculate_order_total('16400000-0000-4000-8000-000000000001',reordered),13::numeric,'permuted choices retain the same price') FROM review_items;
UPDATE menu_items SET variants='[{"name":"Petit","price":6}]' WHERE id='16500000-0000-4000-8000-000000000001';
SELECT extensions.ok(calculate_order_total('16400000-0000-4000-8000-000000000001',jsonb_set(normal,'{0,custom_choices}',normal#>'{0,custom_choices}' || '[{"stepKey":"variant","selections":[{"name":"Petit"}]}]'::jsonb)) IS NULL,'simultaneous variant and base is ambiguous and rejected') FROM review_items;
SELECT extensions.throws_ok($$SELECT place_order_once('16700000-0000-4000-8000-000000000001',(SELECT jsonb_build_object('restaurant_id','16400000-0000-4000-8000-000000000001','customer_name','QA Review','customer_phone','0600000000','order_type','collect','items',reordered,'subtotal',10,'total',10) FROM review_items))$$,'22023','invalid_total','reordered request cannot erase extra price');
SELECT extensions.lives_ok($$SELECT place_order_once('16700000-0000-4000-8000-000000000002',(SELECT jsonb_build_object('restaurant_id','16400000-0000-4000-8000-000000000001','customer_name','QA Review','customer_phone','0600000000','order_type','collect','items',reordered,'subtotal',13,'total',13) FROM review_items))$$,'canonical reordered request is accepted');
SELECT extensions.is((SELECT count(*)::int FROM orders WHERE restaurant_id='16400000-0000-4000-8000-000000000001'),1,'only the correct price produces an order');
SELECT * FROM extensions.finish();
ROLLBACK;
