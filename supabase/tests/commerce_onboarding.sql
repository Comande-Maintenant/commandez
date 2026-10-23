BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
CREATE TEMP TABLE commerce_tap(result text);
GRANT SELECT, INSERT ON commerce_tap TO authenticated, anon;
INSERT INTO commerce_tap SELECT extensions.plan(26);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('26102300-0000-4000-8000-000000000001','commerce1@example.test',now()),
 ('26102300-0000-4000-8000-000000000002','commerce2@example.test',now()),
 ('26102300-0000-4000-8000-000000000003','unconfirmed@example.test',NULL);
SELECT set_config('request.jwt.claim.sub','26102300-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"26102300-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000001','{"name":"Legacy","slug":"qa-261023-legacy"}','[]','{}');
SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000002','{"name":"Restaurant","slug":"qa-261023-restaurant","business_type":"restaurant"}','[]','{}');
SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000003','{"name":"Grocery","slug":"qa-261023-grocery","business_type":"epicerie"}','[{"name":"Sandwich","category":"Products","price":4.5,"product_type":"tacos"}]','{"sauces":[{"name":"Not a grocery default"}]}');
SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000004','{"name":"Florist","slug":"qa-261023-florist","business_type":"fleuriste"}','[{"name":"Bouquet","category":"Flowers","price":25,"product_type":"tacos"}]','{}');
INSERT INTO commerce_tap SELECT extensions.is((SELECT business_type FROM restaurants WHERE slug='qa-261023-legacy'),'restaurant','legacy call remains restaurant');
INSERT INTO commerce_tap SELECT extensions.is((SELECT business_type FROM restaurants WHERE slug='qa-261023-restaurant'),'restaurant','explicit restaurant');
INSERT INTO commerce_tap SELECT extensions.is((SELECT business_type FROM restaurants WHERE slug='qa-261023-grocery'),'epicerie','grocery type persists');
INSERT INTO commerce_tap SELECT extensions.is((SELECT business_type FROM restaurants WHERE slug='qa-261023-florist'),'fleuriste','florist type persists');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE slug LIKE 'qa-261023-%' AND owner_id='26102300-0000-4000-8000-000000000001'),4,'owner always comes from authenticated identity');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE slug LIKE 'qa-261023-%' AND subscription_status='free'),4,'all business types free');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE slug LIKE 'qa-261023-%' AND trial_end_date IS NOT NULL),0,'no automatic expiry');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM menu_items m JOIN restaurants r ON r.id=m.restaurant_id WHERE r.slug IN ('qa-261023-grocery','qa-261023-florist') AND m.product_type='simple'),2,'nonrestaurant products remain simple');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM menu_items m JOIN restaurants r ON r.id=m.restaurant_id WHERE r.slug IN ('qa-261023-grocery','qa-261023-florist')),2,'no invented products');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM restaurant_sauces s JOIN restaurants r ON r.id=s.restaurant_id WHERE r.slug IN ('qa-261023-grocery','qa-261023-florist')),0,'restaurant defaults ignored for other businesses');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM subscriptions s JOIN restaurants r ON r.id=s.restaurant_id WHERE r.slug LIKE 'qa-261023-%' AND s.status='free' AND s.trial_end IS NULL),4,'free subscriptions without expiry');
INSERT INTO commerce_tap SELECT extensions.throws_ok($$SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000005','{"name":"Invalid","slug":"qa-261023-invalid","business_type":"admin"}','[]','{}')$$,'22023','invalid_business_type','unknown business type refused');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE slug='qa-261023-invalid'),0,'invalid type leaves no shop');
SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000003','{"name":"Changed","slug":"qa-261023-grocery","business_type":"fleuriste"}','[]','{}');
INSERT INTO commerce_tap SELECT extensions.is((SELECT business_type FROM restaurants WHERE slug='qa-261023-grocery'),'epicerie','retry cannot change the original business type');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM menu_items m JOIN restaurants r ON r.id=m.restaurant_id WHERE r.slug='qa-261023-grocery'),1,'retry preserves original catalogue');
SELECT set_config('request.jwt.claim.sub','26102300-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"26102300-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000003','{"name":"Second","slug":"qa-261023-second","business_type":"epicerie","owner_id":"26102300-0000-4000-8000-000000000001"}','[]','{}');
RESET ROLE;
INSERT INTO commerce_tap SELECT extensions.is((SELECT owner_id::text FROM restaurants WHERE slug='qa-261023-second'),'26102300-0000-4000-8000-000000000002','forged owner ignored');
INSERT INTO commerce_tap SELECT extensions.is((SELECT owner_id::text FROM restaurants WHERE slug='qa-261023-grocery'),'26102300-0000-4000-8000-000000000001','original owner untouched');
SET LOCAL ROLE authenticated;
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE slug='qa-261023-grocery'),0,'another owner cannot read the private restaurant row');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE anon;
INSERT INTO commerce_tap SELECT extensions.throws_ok($$SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000006','{"name":"Anon","slug":"qa-261023-anon"}','[]','{}')$$,'42501',NULL,'anonymous cannot publish');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','26102300-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"26102300-0000-4000-8000-000000000003","role":"authenticated"}',true);
INSERT INTO commerce_tap SELECT extensions.throws_ok($$SELECT public.complete_onboarding('26102301-0000-4000-8000-000000000007','{"name":"Unconfirmed","slug":"qa-261023-unconfirmed"}','[]','{}')$$,'42501','authentication_required','unconfirmed email cannot publish');
INSERT INTO commerce_tap SELECT extensions.is((SELECT minimum_order FROM restaurants WHERE slug='qa-261023-restaurant'),10::numeric,'restaurant minimum unchanged');
INSERT INTO commerce_tap SELECT extensions.is((SELECT count(*)::int FROM restaurants WHERE slug IN ('qa-261023-grocery','qa-261023-florist') AND minimum_order=0),2,'retail allows a single inexpensive product');
SELECT set_config('request.jwt.claim.sub','26102300-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"26102300-0000-4000-8000-000000000002","role":"authenticated"}',true);
CREATE TEMP TABLE retail_payloads AS
 SELECT r.slug,jsonb_build_object('restaurant_id',r.id,'customer_name','Client QA','customer_phone','0600000000','customer_email','commerce2@example.test','order_type','collect','payment_method','cash','items',jsonb_build_array(jsonb_build_object('menu_item_id',m.id,'name',m.name,'quantity',1)),'subtotal',m.price,'total',m.price) AS payload
 FROM restaurants r JOIN menu_items m ON m.restaurant_id=r.id WHERE r.slug IN ('qa-261023-grocery','qa-261023-florist');
CREATE TEMP TABLE grocery_order AS SELECT * FROM public.place_order_once('26102302-0000-4000-8000-000000000001',(SELECT payload FROM retail_payloads WHERE slug='qa-261023-grocery'));
INSERT INTO commerce_tap SELECT extensions.is((SELECT total FROM grocery_order),4.5::numeric,'grocery checkout calculates the catalogue price');
CREATE TEMP TABLE florist_order AS SELECT * FROM public.place_order_once('26102302-0000-4000-8000-000000000002',(SELECT payload FROM retail_payloads WHERE slug='qa-261023-florist'));
INSERT INTO commerce_tap SELECT extensions.is((SELECT total FROM florist_order),25::numeric,'florist checkout calculates the catalogue price');
INSERT INTO commerce_tap SELECT extensions.throws_ok($$SELECT public.place_order_once('26102302-0000-4000-8000-000000000003',(SELECT payload || '{"subtotal":1,"total":1}'::jsonb FROM retail_payloads WHERE slug='qa-261023-grocery'))$$,'22023','invalid_total','grocery forged checkout price refused');
INSERT INTO commerce_tap SELECT extensions.throws_ok($$SELECT public.place_order_once('26102302-0000-4000-8000-000000000004',(SELECT payload || '{"subtotal":1,"total":1}'::jsonb FROM retail_payloads WHERE slug='qa-261023-florist'))$$,'22023','invalid_total','florist forged checkout price refused');
INSERT INTO commerce_tap SELECT * FROM extensions.finish();
DO $$ BEGIN
 IF (SELECT count(*) FROM commerce_tap WHERE result ~ '^(not )?ok ') <> 26
    OR EXISTS(SELECT 1 FROM commerce_tap WHERE result LIKE 'not ok%') THEN
   RAISE EXCEPTION '%', (SELECT string_agg(result,E'\n') FROM commerce_tap);
 END IF;
END $$;
ROLLBACK;
