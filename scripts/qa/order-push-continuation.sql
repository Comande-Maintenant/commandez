\set ON_ERROR_STOP on
-- Run only in the isolated PostgreSQL container, with
-- PGOPTIONS='-c commandeici.qa_isolated=true'. No HTTP extension may be installed.
-- All temporary schema replacements roll back; no order/device fixture is needed.
BEGIN;
DO $$ BEGIN
 IF current_setting('commandeici.qa_isolated',true) IS DISTINCT FROM 'true'
   OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='net' AND p.proname='http_post') THEN
   RAISE EXCEPTION 'isolated_database_with_no_HTTP_transport_required';
 END IF;
END; $$;

ALTER VIEW vault.decrypted_secrets RENAME TO qa_saved_decrypted_secrets;
CREATE VIEW vault.decrypted_secrets AS
 SELECT 'commandeici_project_url'::text AS name,'https://qa.supabase.co'::text AS decrypted_secret
 UNION ALL SELECT 'commandeici_order_push_cron_secret','qa-local-worker-secret-never-a-production-secret';
ALTER TABLE public.order_push_outbox RENAME TO qa_saved_order_push_outbox;
CREATE TABLE public.order_push_outbox(status TEXT,next_attempt_at TIMESTAMPTZ,leased_until TIMESTAMPTZ);
CREATE TEMP TABLE qa_dispatch_calls(id BIGINT GENERATED ALWAYS AS IDENTITY,url TEXT,headers JSONB,body JSONB,timeout_ms INTEGER);
CREATE SCHEMA IF NOT EXISTS net;
CREATE FUNCTION net.http_post(url TEXT,headers JSONB,body JSONB,timeout_milliseconds INTEGER) RETURNS BIGINT
LANGUAGE plpgsql AS $$ DECLARE result BIGINT; BEGIN
 INSERT INTO pg_temp.qa_dispatch_calls(url,headers,body,timeout_ms)
 VALUES(url,headers,body,timeout_milliseconds) RETURNING id INTO result;
 RETURN result;
END; $$;

INSERT INTO public.order_push_outbox VALUES('pending',now()-interval '1 second',NULL);
UPDATE public.order_push_dispatch_state SET last_enqueued_at=clock_timestamp()-interval '1 minute';
DO $$ BEGIN
 IF public.dispatch_order_push() IS NULL THEN RAISE EXCEPTION 'initial_dispatch_not_queued'; END IF;
 IF public.dispatch_order_push() IS NOT NULL THEN RAISE EXCEPTION 'initial_dispatch_not_coalesced'; END IF;
 IF (SELECT count(*) FROM pg_temp.qa_dispatch_calls)<>1 THEN RAISE EXCEPTION 'initial_dispatch_count'; END IF;
 -- The baseline zero-argument dispatch suppressed this immediate continuation.
 IF to_regprocedure('public.dispatch_order_push(boolean)') IS NULL THEN
   RAISE EXCEPTION 'continuation_cannot_bypass_initial_coalescing';
 END IF;
 IF public.dispatch_order_push(true) IS NULL THEN RAISE EXCEPTION 'continuation_still_coalesced'; END IF;
 IF public.dispatch_order_push(false) IS NOT NULL OR public.dispatch_order_push(NULL::boolean) IS NOT NULL THEN
   RAISE EXCEPTION 'non_continuation_bypassed_coalescing'; END IF;
 IF (SELECT count(*) FROM pg_temp.qa_dispatch_calls)<>2 THEN RAISE EXCEPTION 'continuation_dispatch_count'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.qa_dispatch_calls WHERE url<>'https://qa.supabase.co/functions/v1/push-order-notification'
   OR headers->>'x-cron-secret'<>'qa-local-worker-secret-never-a-production-secret'
   OR body<>'{}'::jsonb OR timeout_ms<>30000) THEN RAISE EXCEPTION 'dispatch_contract_changed'; END IF;
END; $$;

SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.dispatch_order_push(true); RAISE EXCEPTION 'anonymous_continuation_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.dispatch_order_push(); RAISE EXCEPTION 'anonymous_initial_dispatch_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.dispatch_order_push(true); RAISE EXCEPTION 'authenticated_continuation_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.dispatch_order_push(); RAISE EXCEPTION 'authenticated_initial_dispatch_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.dispatch_order_push(true) IS NULL THEN RAISE EXCEPTION 'worker_continuation_denied'; END IF;
END; $$;
RESET ROLE;

UPDATE public.order_push_outbox SET status='processing',leased_until=now()+interval '1 minute';
DO $$ BEGIN
 IF public.dispatch_order_push(true) IS NOT NULL THEN RAISE EXCEPTION 'active_leased_jobs_dispatched'; END IF;
 IF (SELECT count(*) FROM pg_temp.qa_dispatch_calls)<>3 THEN RAISE EXCEPTION 'empty_queue_http_call'; END IF;
END; $$;
UPDATE public.order_push_outbox SET leased_until=now()-interval '1 second';
DO $$ BEGIN
 IF public.dispatch_order_push(true) IS NULL THEN RAISE EXCEPTION 'expired_lease_not_recoverable'; END IF;
END; $$;
UPDATE public.order_push_outbox SET status='pending',next_attempt_at=now()+interval '1 minute';
DO $$ BEGIN
 IF public.dispatch_order_push(true) IS NOT NULL THEN RAISE EXCEPTION 'future_retry_dispatched_early'; END IF;
END; $$;
UPDATE public.order_push_outbox SET next_attempt_at=now()-interval '1 second';
CREATE OR REPLACE VIEW vault.decrypted_secrets AS SELECT NULL::text AS name,NULL::text AS decrypted_secret WHERE false;
DO $$ BEGIN
 IF public.dispatch_order_push(true) IS NOT NULL THEN RAISE EXCEPTION 'unconfigured_continuation_dispatched'; END IF;
 IF (SELECT count(*) FROM pg_temp.qa_dispatch_calls)<>4 THEN RAISE EXCEPTION 'unexpected_HTTP_call_count'; END IF;
END; $$;
SELECT 'PASS: continuation, initial coalescing, tenant role boundary, leases, retry and inert configuration' AS result;
ROLLBACK;
