\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('a1800000-0000-4000-8000-000000000001','qa-push-a@example.test',now()),
 ('a1800000-0000-4000-8000-000000000002','qa-push-b@example.test',now()),
 ('a1800000-0000-4000-8000-000000000003','qa-push-customer@example.test',now());
INSERT INTO owners(id,email,phone) VALUES
 ('a1800000-0000-4000-8000-000000000001','qa-push-a@example.test',''),
 ('a1800000-0000-4000-8000-000000000002','qa-push-b@example.test','');
INSERT INTO restaurants(id,name,slug,owner_id,is_demo,is_open,is_accepting_orders) VALUES
 ('b1800000-0000-4000-8000-000000000001','QA Push A','qa-push-a','a1800000-0000-4000-8000-000000000001',false,true,true),
 ('b1800000-0000-4000-8000-000000000002','QA Push B','qa-push-b','a1800000-0000-4000-8000-000000000002',false,true,true),
 ('b1800000-0000-4000-8000-000000000003','QA Push Demo','qa-push-demo','a1800000-0000-4000-8000-000000000001',true,true,true);
SELECT set_config('request.jwt.claim.sub','a1800000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM register_order_push_device(repeat('a',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64)); RAISE EXCEPTION 'customer erroneously accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a1800000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM register_order_push_device(repeat('a',64),'sandbox','f1800000-0000-4000-8000-000000000001',repeat('1',64)); RAISE EXCEPTION 'sandbox erroneously accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM register_order_push_device('invalid','production','f1800000-0000-4000-8000-000000000001',repeat('1',64)); RAISE EXCEPTION 'invalid token accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM register_order_push_device(repeat('a',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64)); RAISE EXCEPTION 'uninitialized device registered';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM initialize_order_push_installation('f1800000-0000-4000-8000-000000000001',repeat('1',64));
 PERFORM initialize_order_push_installation('f1800000-0000-4000-8000-000000000001',repeat('1',64));
 PERFORM register_order_push_device(repeat('A',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64));
 PERFORM register_order_push_device(repeat('a',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64));
 PERFORM initialize_order_push_installation('f1800000-0000-4000-8000-000000000002',repeat('2',64));
 BEGIN PERFORM register_order_push_device(repeat('a',64),'production','f1800000-0000-4000-8000-000000000002',repeat('2',64)); RAISE EXCEPTION 'token stolen by other installation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM claim_order_push(1); RAISE EXCEPTION 'authenticated claimed outbox';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM count(*) FROM order_push_devices; RAISE EXCEPTION 'authenticated read device tokens';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM order_push_devices WHERE token=repeat('a',64))<>1 THEN RAISE EXCEPTION 'device not idempotent'; END IF; END; $$;
INSERT INTO orders(id,restaurant_id,customer_name,customer_phone,order_type,items,subtotal,total,source,status) VALUES
 ('c1800000-0000-4000-8000-000000000001','b1800000-0000-4000-8000-000000000001','QA','', 'collect','[]',0,0,'web','new'),
 ('c1800000-0000-4000-8000-000000000002','b1800000-0000-4000-8000-000000000002','QA','', 'collect','[]',0,0,'web','new'),
 ('c1800000-0000-4000-8000-000000000003','b1800000-0000-4000-8000-000000000003','QA','', 'collect','[]',0,0,'demo','new');
DO $$ BEGIN IF (SELECT count(*) FROM order_push_outbox WHERE order_id::text LIKE 'c180%')<>1 THEN RAISE EXCEPTION 'tenant/demo isolation failed'; END IF; END; $$;
SAVEPOINT rollback_order;
INSERT INTO orders(restaurant_id,customer_name,customer_phone,order_type,items,subtotal,total,status) VALUES
 ('b1800000-0000-4000-8000-000000000001','rollback','', 'collect','[]',0,0,'new');
ROLLBACK TO rollback_order;
DO $$ BEGIN IF (SELECT count(*) FROM order_push_outbox WHERE restaurant_id='b1800000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'outbox escaped order rollback'; END IF; END; $$;
CREATE TEMP TABLE qa_push_claim AS SELECT * FROM claim_order_push(1);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM qa_push_claim) THEN RAISE EXCEPTION 'claim missing'; END IF;
 IF EXISTS(SELECT 1 FROM claim_order_push(100)) THEN RAISE EXCEPTION 'active lease claimed twice'; END IF;
 IF NOT authorize_order_push((SELECT id FROM qa_push_claim),(SELECT lease FROM qa_push_claim)) THEN RAISE EXCEPTION 'legitimate delivery rejected'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub','a1800000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT initialize_order_push_installation('f1800000-0000-4000-8000-000000000001',repeat('1',64));
SELECT register_order_push_device(repeat('b',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64));
DO $$ BEGIN
 BEGIN PERFORM register_order_push_device(repeat('c',64),'production','f1800000-0000-4000-8000-000000000001',repeat('9',64)); RAISE EXCEPTION 'wrong installation secret accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF authorize_order_push((SELECT id FROM qa_push_claim),(SELECT lease FROM qa_push_claim)) THEN RAISE EXCEPTION 'old owner lease survived transfer'; END IF;
 IF finish_order_push((SELECT id FROM qa_push_claim),(SELECT lease FROM qa_push_claim),'invalid_token') THEN RAISE EXCEPTION 'stale delivery acknowledged'; END IF;
END; $$;
SELECT set_config('request.jwt.claim.sub','a1800000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM register_order_push_device(repeat('a',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64)); RAISE EXCEPTION 'old owner reclaimed installation by late token callback';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
SELECT unregister_order_push_device(repeat('a',64));
RESET ROLE;
DO $$ BEGIN IF NOT (SELECT enabled FROM order_push_devices WHERE token=repeat('b',64)) THEN RAISE EXCEPTION 'old owner revoked new owner device'; END IF; END; $$;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM order_push_devices WHERE token=repeat('a',64)) THEN RAISE EXCEPTION 'rotated token retained'; END IF; END; $$;
INSERT INTO orders(id,restaurant_id,customer_name,customer_phone,order_type,items,subtotal,total,status) VALUES
 ('c1800000-0000-4000-8000-000000000004','b1800000-0000-4000-8000-000000000002','QA','', 'collect','[]',0,0,'new');
TRUNCATE qa_push_claim;
INSERT INTO qa_push_claim SELECT * FROM claim_order_push(1);
SELECT finish_order_push(id,lease,'retry','TooManyRequests',120) FROM qa_push_claim;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM claim_order_push(100)) THEN RAISE EXCEPTION 'retry delay ignored'; END IF;
 IF NOT EXISTS(SELECT 1 FROM order_push_outbox WHERE order_id='c1800000-0000-4000-8000-000000000004' AND attempts=1 AND status='pending' AND next_attempt_at>=now()+interval '119 seconds') THEN RAISE EXCEPTION 'durable retry missing'; END IF;
END; $$;
UPDATE order_push_outbox SET next_attempt_at=now()-interval '1 second' WHERE order_id='c1800000-0000-4000-8000-000000000004';
TRUNCATE qa_push_claim;
INSERT INTO qa_push_claim SELECT * FROM claim_order_push(1);
UPDATE order_push_outbox SET leased_until=now()-interval '1 second' WHERE order_id='c1800000-0000-4000-8000-000000000004';
DO $$ BEGIN
 IF finish_order_push((SELECT id FROM qa_push_claim),(SELECT lease FROM qa_push_claim),'cancelled','recipient_changed') THEN RAISE EXCEPTION 'expired lease cancelled a recoverable order'; END IF;
 IF NOT EXISTS(SELECT 1 FROM order_push_outbox WHERE order_id='c1800000-0000-4000-8000-000000000004' AND status='processing') THEN RAISE EXCEPTION 'expired job not recoverable'; END IF;
END; $$;
CREATE TEMP TABLE qa_push_reclaimed AS SELECT * FROM claim_order_push(1);
DO $$ BEGIN
 IF (SELECT lease FROM qa_push_claim)=(SELECT lease FROM qa_push_reclaimed) THEN RAISE EXCEPTION 'expired lease not renewed'; END IF;
 IF finish_order_push((SELECT id FROM qa_push_claim),(SELECT lease FROM qa_push_claim),'sent') THEN RAISE EXCEPTION 'stale worker acknowledged'; END IF;
END; $$;
SELECT finish_order_push(id,lease,'invalid_token','Unregistered',60) FROM qa_push_reclaimed;
DO $$ BEGIN IF (SELECT enabled FROM order_push_devices WHERE token=repeat('b',64)) THEN RAISE EXCEPTION '410 did not disable token'; END IF; END; $$;
SELECT set_config('request.jwt.claim.sub','a1800000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT register_order_push_device(repeat('b',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64));
RESET ROLE;
UPDATE order_push_devices SET expires_at=now()-interval '1 second' WHERE token=repeat('b',64);
INSERT INTO orders(id,restaurant_id,customer_name,customer_phone,order_type,items,subtotal,total,status) VALUES
 ('c1800000-0000-4000-8000-000000000005','b1800000-0000-4000-8000-000000000002','QA expired','', 'collect','[]',0,0,'new');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM order_push_outbox WHERE order_id='c1800000-0000-4000-8000-000000000005') THEN RAISE EXCEPTION 'expired device enqueued'; END IF; END; $$;
SET LOCAL ROLE authenticated;
SELECT register_order_push_device(repeat('b',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64));
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM order_push_devices WHERE token=repeat('b',64) AND expires_at>=now()+interval '29 days') THEN RAISE EXCEPTION 'lease not renewed'; END IF; END; $$;
SET LOCAL ROLE anon;
SELECT revoke_order_push_installation('f1800000-0000-4000-8000-000000000001',repeat('9',64));
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM order_push_devices WHERE token=repeat('b',64)) THEN RAISE EXCEPTION 'wrong capability revoked device'; END IF; END; $$;
SET LOCAL ROLE anon;
SELECT revoke_order_push_installation('f1800000-0000-4000-8000-000000000001',repeat('1',64));
SELECT revoke_order_push_installation('f1800000-0000-4000-8000-000000000001',repeat('1',64));
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM order_push_devices WHERE token=repeat('b',64)) OR EXISTS(SELECT 1 FROM order_push_outbox WHERE order_id::text LIKE 'c180%') THEN RAISE EXCEPTION 'capability cleanup incomplete'; END IF; END; $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM register_order_push_device(repeat('c',64),'production','f1800000-0000-4000-8000-000000000001',repeat('1',64)); RAISE EXCEPTION 'late registration survived tombstone';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT revoke_order_push_installation('f1800000-0000-4000-8000-000000000099',repeat('7',64));
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM order_push_revoked_installations WHERE installation_id='f1800000-0000-4000-8000-000000000099') OR
    EXISTS(SELECT 1 FROM order_push_devices WHERE installation_id='f1800000-0000-4000-8000-000000000099') THEN RAISE EXCEPTION 'unknown anon revocation wrote rows'; END IF;
END; $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM register_order_push_device(repeat('d',64),'production','f1800000-0000-4000-8000-000000000099',repeat('7',64)); RAISE EXCEPTION 'uninitialized late registration accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM initialize_order_push_installation('f1800000-0000-4000-8000-000000000099',repeat('7',64));
END; $$;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM order_push_devices WHERE installation_id='f1800000-0000-4000-8000-000000000099' AND token IS NULL AND NOT enabled) THEN RAISE EXCEPTION 'late bootstrap activated device'; END IF; END; $$;
SET LOCAL ROLE anon;
SELECT revoke_order_push_installation('f1800000-0000-4000-8000-000000000099',repeat('7',64));
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM register_order_push_device(repeat('d',64),'production','f1800000-0000-4000-8000-000000000099',repeat('7',64)); RAISE EXCEPTION 'late registration survived initialized revoke';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT dispatch_order_push(); -- no Vault secret means no net call, even without pg_net installed
ROLLBACK;
