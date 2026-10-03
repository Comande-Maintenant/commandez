\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(25);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('17100000-0000-4000-8000-000000000001','qa-overlap-ban-owner@example.test',now()),
 ('17100000-0000-4000-8000-000000000002','qa-overlap-ban-alice@example.test',now()),
 ('17100000-0000-4000-8000-000000000003','qa-overlap-ban-bob@example.test',now()),
 ('17100000-0000-4000-8000-000000000004','qa-overlap-ban-other@example.test',now());
INSERT INTO owners(id,email,phone) VALUES('17100000-0000-4000-8000-000000000001','qa-overlap-ban-owner@example.test','');
INSERT INTO restaurants(id,name,slug,owner_id,is_open,is_accepting_orders,availability_mode)
 VALUES('17200000-0000-4000-8000-000000000001','QA Overlap Ban','qa-overlap-ban','17100000-0000-4000-8000-000000000001',true,true,'manual');
INSERT INTO menu_items(id,restaurant_id,name,price,category,product_type,enabled,is_alcohol)
 VALUES('17300000-0000-4000-8000-000000000001','17200000-0000-4000-8000-000000000001','Pizza',12,'Plats','simple',true,false);
CREATE TEMP TABLE qa_ban_payload AS SELECT jsonb_build_object('restaurant_id','17200000-0000-4000-8000-000000000001','customer_name','Alice','customer_phone','0600000000','order_type','collect','items',jsonb_build_array(jsonb_build_object('menu_item_id','17300000-0000-4000-8000-000000000001','name','Pizza','quantity',1)),'subtotal',12,'total',12) payload;
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT place_order_once('17400000-0000-4000-8000-000000000001',(SELECT payload FROM qa_ban_payload));
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT place_order_once('17400000-0000-4000-8000-000000000002',(SELECT payload||'{"customer_name":"Bob"}' FROM qa_ban_payload));
SELECT extensions.is((SELECT customer_user_id::text FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001'),'17100000-0000-4000-8000-000000000003','displayed Bob is associated with Bob account');
SELECT extensions.is((SELECT count(*)::int FROM restaurant_customer_accounts WHERE customer_id=(SELECT id FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001')),2,'shared phone retains separate observed accounts');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SELECT extensions.throws_ok($$SELECT set_restaurant_customer_ban((SELECT id FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001'),'17100000-0000-4000-8000-000000000003',true,'test')$$,'42501','forbidden','another account cannot ban merchant customer');
SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT count(*)::int FROM restaurant_customer_accounts),0,'client cannot enumerate account links');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT extensions.throws_ok($$SELECT set_restaurant_customer_ban((SELECT id FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001'),'17100000-0000-4000-8000-000000000002',true,'test')$$,'22023','customer_identity_changed','stale Alice snapshot is refused');
SELECT set_restaurant_customer_ban((SELECT id FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001'),'17100000-0000-4000-8000-000000000003',true,'test');
SELECT extensions.is((SELECT count(*)::int FROM restaurant_customer_account_bans WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_user_id='17100000-0000-4000-8000-000000000003'),1,'only displayed Bob UID is banned');
SELECT extensions.is((SELECT count(*)::int FROM restaurant_customer_account_bans WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_user_id='17100000-0000-4000-8000-000000000002'),0,'historical Alice UID is not automatically banned');
UPDATE restaurant_customers SET customer_user_id='17100000-0000-4000-8000-000000000002',customer_name='Wrong account' WHERE restaurant_id='17200000-0000-4000-8000-000000000001';
SELECT extensions.is((SELECT customer_user_id::text FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001'),'17100000-0000-4000-8000-000000000003','active banned identity remains a stable snapshot');
UPDATE restaurant_customers SET customer_user_id=NULL WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_phone='0600000000';
SELECT extensions.is((SELECT customer_user_id::text FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_phone='0600000000'),'17100000-0000-4000-8000-000000000003','clearing an existing banned UID cannot bypass its stable snapshot');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT extensions.throws_ok($$SELECT place_order_once('17400000-0000-4000-8000-000000000003',(SELECT payload||'{"customer_name":"Bob","customer_phone":"0700000000","customer_email":"changed@example.test"}' FROM qa_ban_payload))$$,'P0001','customer_banned','Bob ban survives changed phone and email');
SELECT extensions.is((SELECT check_customer_ban('17200000-0000-4000-8000-000000000001','0700000000','changed@example.test')->>'banned'),'true','client preflight sees stable account ban');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT extensions.lives_ok($$SELECT place_order_once('17400000-0000-4000-8000-000000000004',(SELECT payload||'{"customer_phone":"0800000000"}' FROM qa_ban_payload))$$,'Alice can order with a different contact');
SELECT extensions.throws_ok($$SELECT place_order_once('17400000-0000-4000-8000-000000000005',(SELECT payload FROM qa_ban_payload))$$,'P0001','customer_banned','legacy shared phone contact remains blocked');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT set_restaurant_customer_ban((SELECT id FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_phone='0600000000'),'17100000-0000-4000-8000-000000000003',false);
SELECT extensions.is((SELECT count(*)::int FROM restaurant_customer_account_bans WHERE restaurant_id='17200000-0000-4000-8000-000000000001'),0,'explicit unban removes Bob account restriction');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT extensions.lives_ok($$SELECT place_order_once('17400000-0000-4000-8000-000000000003',(SELECT payload||'{"customer_name":"Bob","customer_phone":"0700000000","customer_email":"changed@example.test"}' FROM qa_ban_payload))$$,'Bob can retry after an explicit unban');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT set_restaurant_customer_ban((SELECT id FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_phone='0700000000'),'17100000-0000-4000-8000-000000000003',true,'expired',now()-interval '1 day');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT extensions.lives_ok($$SELECT place_order_once('17400000-0000-4000-8000-000000000006',(SELECT payload||'{"customer_name":"Bob","customer_phone":"0900000000"}' FROM qa_ban_payload))$$,'expired UID restriction does not block');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT place_order_once('17400000-0000-4000-8000-000000000007',(SELECT payload||'{"customer_name":"Counter client","customer_phone":"0500000000","source":"pos"}' FROM qa_ban_payload));
SELECT extensions.ok((SELECT customer_user_id IS NULL FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_phone='0500000000'),'POS owner is never represented as customer UID');
SELECT extensions.is((SELECT count(*)::int FROM restaurant_customer_accounts WHERE customer_user_id='17100000-0000-4000-8000-000000000001'),0,'POS owner is excluded from observed client accounts');
SELECT extensions.ok(NOT has_table_privilege('anon','public.restaurant_customer_account_bans','SELECT'),'anonymous cannot enumerate account bans');
-- Deleting an actively banned account must allow the FK's SET NULL, even
-- when the contact email is blank/different from its authentication email.
SELECT set_restaurant_customer_ban((SELECT id FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_phone='0900000000'),'17100000-0000-4000-8000-000000000003',true,'delete fixture');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT extensions.lives_ok($$SELECT delete_own_account('DELETE')$$,'actively banned account with divergent contact email can delete itself');
SELECT extensions.is((SELECT count(*)::int FROM auth.users WHERE id='17100000-0000-4000-8000-000000000003'),0,'banned authentication identity is deleted');
SELECT extensions.ok((SELECT customer_user_id IS NULL AND customer_name='Compte supprime' AND customer_email='' FROM restaurant_customers WHERE restaurant_id='17200000-0000-4000-8000-000000000001' AND customer_phone='0900000000'),'deleted banned identity is anonymized without reassigning ban');
SELECT extensions.is((SELECT count(*)::int FROM restaurant_customer_account_bans WHERE customer_user_id='17100000-0000-4000-8000-000000000003'),0,'deleted account ban capability is removed');
SELECT extensions.is((SELECT count(*)::int FROM auth.users WHERE id='17100000-0000-4000-8000-000000000001'),1,'merchant owner remains intact');
SELECT set_config('request.jwt.claim.sub','17100000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT extensions.lives_ok($$SELECT place_order_once('17400000-0000-4000-8000-000000000008',(SELECT payload||'{"customer_phone":"0810000000"}' FROM qa_ban_payload))$$,'deleting Bob never broadens ban to historical Alice account');
SELECT * FROM extensions.finish();
ROLLBACK;
