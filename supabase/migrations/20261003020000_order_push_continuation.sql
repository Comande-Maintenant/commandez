BEGIN;
-- Only a server worker continuing a claimed batch bypasses initial enqueue coalescing.
-- The original zero-argument contract remains in use by order INSERT and cron.
CREATE OR REPLACE FUNCTION public.dispatch_order_push(p_continue BOOLEAN) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE base_url TEXT; secret TEXT; request_id BIGINT; last_dispatch TIMESTAMPTZ;
BEGIN
 SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name='commandeici_project_url' LIMIT 1;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='commandeici_order_push_cron_secret' LIMIT 1;
 IF base_url IS NULL OR base_url !~ '^https://[a-z0-9]+\.supabase\.co/?$' OR length(coalesce(secret,''))<32 THEN RETURN NULL; END IF;
 SELECT last_enqueued_at INTO last_dispatch FROM order_push_dispatch_state WHERE singleton=true FOR UPDATE;
 -- Recheck after the dispatch-state lock: overlapping workers may have drained the queue.
 IF NOT EXISTS(SELECT 1 FROM order_push_outbox WHERE next_attempt_at<=now()
   AND (status='pending' OR (status='processing' AND leased_until<now()))) THEN RETURN NULL; END IF;
 IF NOT coalesce(p_continue,false) AND last_dispatch>clock_timestamp()-interval '5 seconds' THEN RETURN NULL; END IF;
 EXECUTE 'SELECT net.http_post(url := $1,headers := $2,body := $3,timeout_milliseconds := 30000)'
   INTO request_id USING rtrim(base_url,'/')||'/functions/v1/push-order-notification',
     jsonb_build_object('Content-Type','application/json','x-cron-secret',secret),'{}'::jsonb;
 UPDATE order_push_dispatch_state SET last_enqueued_at=clock_timestamp() WHERE singleton=true;
 RETURN request_id;
END; $$;
REVOKE ALL ON FUNCTION public.dispatch_order_push(BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_order_push(BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_order_push() RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.dispatch_order_push(false);
$$;
-- CREATE OR REPLACE keeps the existing zero-argument ACL; keep its server boundary explicit.
REVOKE ALL ON FUNCTION public.dispatch_order_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_order_push() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
