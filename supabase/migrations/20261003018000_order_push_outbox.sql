BEGIN;
CREATE TABLE IF NOT EXISTS public.order_push_devices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 token TEXT UNIQUE CHECK(token ~ '^[a-f0-9]{64}$'),
 installation_id UUID NOT NULL UNIQUE,
 installation_secret_hash TEXT NOT NULL,
 environment TEXT NOT NULL CHECK(environment='production'),
 platform TEXT NOT NULL DEFAULT 'ios' CHECK(platform='ios'),
 generation UUID NOT NULL DEFAULT gen_random_uuid(),
 enabled BOOLEAN NOT NULL DEFAULT true,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 days',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Also supports safely replaying the draft in the isolated development database.
ALTER TABLE public.order_push_devices ADD COLUMN IF NOT EXISTS installation_id UUID NOT NULL UNIQUE;
ALTER TABLE public.order_push_devices ADD COLUMN IF NOT EXISTS installation_secret_hash TEXT NOT NULL;
ALTER TABLE public.order_push_devices ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 days';
ALTER TABLE public.order_push_devices ALTER COLUMN token DROP NOT NULL;
CREATE TABLE IF NOT EXISTS public.order_push_revoked_installations (
 installation_id UUID PRIMARY KEY, installation_secret_hash TEXT NOT NULL, revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.order_push_dispatch_state (
 singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK(singleton), last_enqueued_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity'
);
INSERT INTO public.order_push_dispatch_state(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.order_push_outbox (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 device_id UUID NOT NULL REFERENCES public.order_push_devices(id) ON DELETE CASCADE,
 generation UUID NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','cancelled','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease UUID, leased_until TIMESTAMPTZ,
 last_reason TEXT, sent_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(order_id,device_id)
);
CREATE INDEX IF NOT EXISTS order_push_due_idx ON public.order_push_outbox(next_attempt_at) WHERE status IN ('pending','processing');
ALTER TABLE public.order_push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_push_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_push_revoked_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_push_dispatch_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_push_devices,public.order_push_outbox,public.order_push_revoked_installations,public.order_push_dispatch_state FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.order_push_devices,public.order_push_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.initialize_order_push_installation(p_installation_id UUID,p_installation_secret TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET statement_timeout='5s' AS $$
DECLARE uid UUID:=auth.uid(); secret_hash TEXT; existing order_push_devices;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM owners WHERE id=uid) OR
    NOT EXISTS(SELECT 1 FROM restaurants WHERE owner_id=uid AND deactivated_at IS NULL) THEN
   RAISE EXCEPTION 'owner_required' USING ERRCODE='42501';
 END IF;
 IF p_installation_id IS NULL OR p_installation_secret IS NULL OR p_installation_secret !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'invalid_push_installation' USING ERRCODE='22023';
 END IF;
 secret_hash:=encode(extensions.digest(p_installation_secret,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_installation_id::text,180));
 IF EXISTS(SELECT 1 FROM order_push_revoked_installations WHERE installation_id=p_installation_id) THEN
   RAISE EXCEPTION 'push_installation_revoked' USING ERRCODE='42501';
 END IF;
 SELECT * INTO existing FROM order_push_devices WHERE installation_id=p_installation_id FOR UPDATE;
 IF FOUND THEN
   IF existing.installation_secret_hash IS DISTINCT FROM secret_hash THEN
     RAISE EXCEPTION 'invalid_push_installation' USING ERRCODE='42501';
   END IF;
   IF existing.owner_id IS DISTINCT FROM uid THEN
     UPDATE order_push_devices SET owner_id=uid,token=NULL,enabled=false,generation=gen_random_uuid(),updated_at=now(),expires_at=now()+interval '30 days'
       WHERE id=existing.id;
     UPDATE order_push_outbox SET status='cancelled',lease=NULL,leased_until=NULL,last_reason='installation_owner_changed'
       WHERE device_id=existing.id AND status IN ('pending','processing');
   END IF;
   RETURN;
 END IF;
 INSERT INTO order_push_devices(owner_id,token,environment,platform,installation_id,installation_secret_hash,enabled)
   VALUES(uid,NULL,'production','ios',p_installation_id,secret_hash,false);
END; $$;
REVOKE ALL ON FUNCTION public.initialize_order_push_installation(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.initialize_order_push_installation(UUID,TEXT) TO authenticated;
DROP FUNCTION IF EXISTS public.register_order_push_device(TEXT,TEXT,TEXT);
CREATE OR REPLACE FUNCTION public.register_order_push_device(p_token TEXT,p_environment TEXT,p_installation_id UUID,p_installation_secret TEXT,p_platform TEXT DEFAULT 'ios')
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET statement_timeout='5s' AS $$
DECLARE uid UUID:=auth.uid(); existing order_push_devices; secret_hash TEXT;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM owners WHERE id=uid) OR
    NOT EXISTS(SELECT 1 FROM restaurants WHERE owner_id=uid AND deactivated_at IS NULL) THEN
   RAISE EXCEPTION 'owner_required' USING ERRCODE='42501';
 END IF;
 IF lower(p_token) !~ '^[a-f0-9]{64}$' OR p_token IS NULL OR
    p_environment IS DISTINCT FROM 'production' OR p_platform IS DISTINCT FROM 'ios' OR p_installation_id IS NULL OR
    p_installation_secret IS NULL OR p_installation_secret !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'invalid_push_device' USING ERRCODE='22023';
 END IF;
 secret_hash:=encode(extensions.digest(p_installation_secret,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_installation_id::text,180));
 IF EXISTS(SELECT 1 FROM order_push_revoked_installations WHERE installation_id=p_installation_id) THEN
   RAISE EXCEPTION 'push_installation_revoked' USING ERRCODE='42501';
 END IF;
 SELECT * INTO existing FROM order_push_devices WHERE installation_id=p_installation_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'push_installation_initialize_required' USING ERRCODE='42501'; END IF;
 IF FOUND AND existing.installation_secret_hash IS DISTINCT FROM secret_hash THEN
   RAISE EXCEPTION 'invalid_push_installation' USING ERRCODE='42501';
 END IF;
 IF existing.owner_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'push_installation_owner_changed' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM order_push_devices WHERE token=lower(p_token) AND installation_id<>p_installation_id) THEN
   RAISE EXCEPTION 'invalid_push_installation' USING ERRCODE='42501';
 END IF;
 INSERT INTO order_push_devices(owner_id,token,environment,platform,installation_id,installation_secret_hash)
   VALUES(uid,lower(p_token),p_environment,p_platform,p_installation_id,secret_hash)
 ON CONFLICT(installation_id) DO UPDATE SET owner_id=uid,token=excluded.token,enabled=true,updated_at=now(),expires_at=now()+interval '30 days',
   generation=CASE WHEN order_push_devices.owner_id IS DISTINCT FROM uid OR order_push_devices.token IS DISTINCT FROM excluded.token OR NOT order_push_devices.enabled
     THEN gen_random_uuid() ELSE order_push_devices.generation END;
 -- Outstanding notifications of an old account never follow a device transfer.
 UPDATE order_push_outbox o SET status='cancelled',lease=NULL,leased_until=NULL,last_reason='device_changed'
 FROM order_push_devices d WHERE d.token=lower(p_token) AND o.device_id=d.id
   AND (o.owner_id<>d.owner_id OR o.generation<>d.generation) AND o.status IN ('pending','processing');
END; $$;
CREATE OR REPLACE FUNCTION public.revoke_order_push_installation(p_installation_id UUID,p_installation_secret TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET statement_timeout='5s' AS $$
DECLARE device order_push_devices; secret_hash TEXT;
BEGIN
 -- Capability cleanup works after session expiry; success/failure is deliberately neutral.
 IF p_installation_id IS NULL OR p_installation_secret IS NULL OR p_installation_secret !~ '^[a-f0-9]{64}$' THEN RETURN; END IF;
 secret_hash:=encode(extensions.digest(p_installation_secret,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_installation_id::text,180));
 SELECT * INTO device FROM order_push_devices WHERE installation_id=p_installation_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF FOUND AND device.installation_secret_hash IS DISTINCT FROM secret_hash THEN RETURN; END IF;
 INSERT INTO order_push_revoked_installations(installation_id,installation_secret_hash) VALUES(p_installation_id,secret_hash)
   ON CONFLICT DO NOTHING;
 DELETE FROM order_push_devices WHERE installation_id=p_installation_id AND installation_secret_hash=secret_hash;
END; $$;
CREATE OR REPLACE FUNCTION public.unregister_order_push_device(p_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET statement_timeout='5s' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 UPDATE order_push_devices SET enabled=false,generation=gen_random_uuid(),updated_at=now()
   WHERE token=lower(p_token) AND owner_id=auth.uid();
 UPDATE order_push_outbox o SET status='cancelled',lease=NULL,leased_until=NULL,last_reason='device_revoked'
   FROM order_push_devices d WHERE d.token=lower(p_token) AND d.owner_id=auth.uid() AND o.device_id=d.id
     AND o.status IN ('pending','processing');
END; $$;
REVOKE ALL ON FUNCTION public.register_order_push_device(TEXT,TEXT,UUID,TEXT,TEXT),public.unregister_order_push_device(TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_order_push_device(TEXT,TEXT,UUID,TEXT,TEXT),public.unregister_order_push_device(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.revoke_order_push_installation(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_order_push_installation(UUID,TEXT) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_order_push() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE queued INTEGER;
BEGIN
 IF NEW.status='new' AND coalesce(NEW.source,'')<>'demo' AND NOT coalesce(NEW.is_test,false) THEN
   INSERT INTO order_push_outbox(order_id,restaurant_id,owner_id,device_id,generation)
   SELECT NEW.id,r.id,r.owner_id,d.id,d.generation FROM restaurants r
     JOIN order_push_devices d ON d.owner_id=r.owner_id AND d.enabled AND d.expires_at>now()
     WHERE r.id=NEW.restaurant_id AND NOT coalesce(r.is_demo,false) AND r.deactivated_at IS NULL
   ON CONFLICT(order_id,device_id) DO NOTHING;
   GET DIAGNOSTICS queued=ROW_COUNT;
   IF queued>0 THEN
     -- pg_net sends after commit. Scheduler remains the recovery path if this kick fails.
     BEGIN PERFORM public.dispatch_order_push(); EXCEPTION WHEN OTHERS THEN NULL; END;
   END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_order_push() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS enqueue_order_push ON public.orders;
CREATE TRIGGER enqueue_order_push AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_push();

CREATE OR REPLACE FUNCTION public.claim_order_push(p_limit INTEGER DEFAULT 4)
RETURNS TABLE(id UUID,order_id UUID,restaurant_id UUID,restaurant_slug TEXT,token TEXT,lease UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Cancel invalid recipients before taking leases. Retry claims expire durably.
 UPDATE order_push_outbox o SET status='cancelled',lease=NULL,leased_until=NULL,last_reason='recipient_or_order_changed'
 WHERE o.status IN ('pending','processing') AND NOT EXISTS(
   SELECT 1 FROM order_push_devices d JOIN restaurants r ON r.id=o.restaurant_id JOIN orders ord ON ord.id=o.order_id
   WHERE d.id=o.device_id AND d.owner_id=o.owner_id AND d.generation=o.generation AND d.enabled AND d.expires_at>now()
     AND r.owner_id=o.owner_id AND r.deactivated_at IS NULL AND NOT coalesce(r.is_demo,false) AND ord.status='new');
 UPDATE order_push_outbox SET status='failed',lease=NULL,leased_until=NULL,last_reason='attempts_exhausted'
   WHERE status IN ('pending','processing') AND attempts>=10 AND (leased_until IS NULL OR leased_until<now());
 RETURN QUERY WITH due AS (
   SELECT o.id FROM order_push_outbox o WHERE o.attempts<10 AND o.next_attempt_at<=now()
     AND (o.status='pending' OR (o.status='processing' AND o.leased_until<now()))
   ORDER BY o.created_at,o.id LIMIT greatest(1,least(coalesce(p_limit,4),4)) FOR UPDATE SKIP LOCKED
 ), claimed AS (
   UPDATE order_push_outbox o SET status='processing',lease=gen_random_uuid(),leased_until=now()+interval '120 seconds',attempts=o.attempts+1
   FROM due WHERE o.id=due.id RETURNING o.*
 ) SELECT c.id,c.order_id,c.restaurant_id,r.slug,d.token,c.lease FROM claimed c
   JOIN restaurants r ON r.id=c.restaurant_id JOIN order_push_devices d ON d.id=c.device_id;
END; $$;
CREATE OR REPLACE FUNCTION public.authorize_order_push(p_id UUID,p_lease UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM order_push_outbox o JOIN order_push_devices d ON d.id=o.device_id
   JOIN restaurants r ON r.id=o.restaurant_id JOIN orders ord ON ord.id=o.order_id
   WHERE o.id=p_id AND o.lease=p_lease AND o.status='processing' AND o.leased_until>now()
     AND d.enabled AND d.expires_at>now() AND d.owner_id=o.owner_id AND d.generation=o.generation
     AND r.owner_id=o.owner_id AND r.deactivated_at IS NULL AND NOT coalesce(r.is_demo,false) AND ord.status='new');
$$;
CREATE OR REPLACE FUNCTION public.finish_order_push(p_id UUID,p_lease UUID,p_result TEXT,p_reason TEXT DEFAULT NULL,p_retry_seconds INTEGER DEFAULT 60)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job order_push_outbox; device UUID;
BEGIN
 -- Consistent device -> outbox lock order, including 410, avoids transfer/revoke deadlocks.
 SELECT device_id INTO device FROM order_push_outbox WHERE id=p_id;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM order_push_devices WHERE id=device FOR UPDATE;
 SELECT * INTO job FROM order_push_outbox WHERE id=p_id AND lease=p_lease AND status='processing' AND leased_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF job.leased_until<=clock_timestamp() THEN RETURN false; END IF;
 IF p_result NOT IN ('sent','retry','invalid_token','failed','cancelled') THEN RAISE EXCEPTION 'invalid_push_result'; END IF;
 IF p_result='invalid_token' THEN
   UPDATE order_push_devices SET enabled=false,generation=gen_random_uuid(),updated_at=now()
     WHERE id=job.device_id AND owner_id=job.owner_id AND generation=job.generation;
 END IF;
 UPDATE order_push_outbox SET status=CASE WHEN p_result='retry' AND attempts<10 THEN 'pending'
     WHEN p_result='retry' THEN 'failed' WHEN p_result='invalid_token' THEN 'cancelled' ELSE p_result END,
   lease=NULL,leased_until=NULL,sent_at=CASE WHEN p_result='sent' THEN now() ELSE sent_at END,
   next_attempt_at=now()+make_interval(secs=>greatest(1,least(coalesce(p_retry_seconds,60),86400))),
   last_reason=left(p_reason,120) WHERE id=p_id;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.claim_order_push(INTEGER),public.authorize_order_push(UUID,UUID),public.finish_order_push(UUID,UUID,TEXT,TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_push(INTEGER),public.authorize_order_push(UUID,UUID),public.finish_order_push(UUID,UUID,TEXT,TEXT,INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_order_push() RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE base_url TEXT; secret TEXT; request_id BIGINT; last_dispatch TIMESTAMPTZ;
BEGIN
 SELECT decrypted_secret INTO base_url FROM vault.decrypted_secrets WHERE name='commandeici_project_url' LIMIT 1;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='commandeici_order_push_cron_secret' LIMIT 1;
 -- Deployment is inert without explicit server configuration. No credentials in SQL.
 IF base_url IS NULL OR base_url !~ '^https://[a-z0-9]+\.supabase\.co/?$' OR length(coalesce(secret,''))<32 THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM order_push_outbox WHERE next_attempt_at<=now()
   AND (status='pending' OR (status='processing' AND leased_until<now()))) THEN RETURN NULL; END IF;
 SELECT last_enqueued_at INTO last_dispatch FROM order_push_dispatch_state WHERE singleton=true FOR UPDATE;
 IF last_dispatch>clock_timestamp()-interval '5 seconds' THEN RETURN NULL; END IF;
 EXECUTE 'SELECT net.http_post(url := $1,headers := $2,body := $3,timeout_milliseconds := 30000)'
   INTO request_id USING rtrim(base_url,'/')||'/functions/v1/push-order-notification',
     jsonb_build_object('Content-Type','application/json','x-cron-secret',secret),'{}'::jsonb;
 UPDATE order_push_dispatch_state SET last_enqueued_at=clock_timestamp() WHERE singleton=true;
 RETURN request_id;
END; $$;
REVOKE ALL ON FUNCTION public.dispatch_order_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_order_push() TO service_role;
DO $$ DECLARE job BIGINT; BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') AND EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
   FOR job IN SELECT jobid FROM cron.job WHERE jobname='commandeici-order-push' LOOP PERFORM cron.unschedule(job); END LOOP;
   PERFORM cron.schedule('commandeici-order-push','* * * * *','SELECT public.dispatch_order_push()');
 ELSE RAISE NOTICE 'Order push cron requires existing pg_cron and pg_net maintenance extensions; no scheduler installed here'; END IF;
END; $$;
COMMIT;
