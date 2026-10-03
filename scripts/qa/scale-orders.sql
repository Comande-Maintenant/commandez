BEGIN;
SELECT set_config('request.jwt.claim.sub',md5('scalecustomer-' || :client_id)::uuid::text,true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',md5('scalecustomer-' || :client_id)::uuid::text,'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT place_order_once(md5('scale-request-' || :client_id)::uuid,(SELECT jsonb_build_object('restaurant_id',r.id,'customer_name','Scale Customer','customer_phone','06' || lpad(:client_id::text,8,'0'),'customer_email','scale-' || :client_id || '@example.test','order_type','collect','items',jsonb_build_array(jsonb_build_object('menu_item_id',m.id,'name',m.name,'quantity',1)),'subtotal',12,'total',12)
 FROM qa_scale_catalog r JOIN menu_items m ON m.restaurant_id=r.id WHERE r.client_id=:client_id));
COMMIT;
