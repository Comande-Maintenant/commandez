BEGIN;
-- Phone contacts can contain several authenticated customers. Keep observed
-- identities separate, and bind a merchant's ban to the identity displayed.
CREATE TABLE IF NOT EXISTS public.restaurant_customer_accounts (
 customer_id UUID NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
 customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 last_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
 last_seen_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(customer_id,customer_user_id)
);
CREATE TABLE IF NOT EXISTS public.restaurant_customer_account_bans (
 restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 customer_id UUID REFERENCES public.restaurant_customers(id) ON DELETE SET NULL,
 banned_reason TEXT NOT NULL DEFAULT '',
 banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ban_expires_at TIMESTAMPTZ,
 banned_ip TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(restaurant_id,customer_user_id)
);
CREATE INDEX IF NOT EXISTS orders_customer_identity_lookup
 ON public.orders(restaurant_id,customer_phone,created_at DESC,order_number DESC,id DESC);
ALTER TABLE public.restaurant_customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_customer_account_bans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_customer_accounts,public.restaurant_customer_account_bans FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.restaurant_customer_accounts,public.restaurant_customer_account_bans TO authenticated;
DROP POLICY IF EXISTS merchant_customer_accounts ON public.restaurant_customer_accounts;
CREATE POLICY merchant_customer_accounts ON public.restaurant_customer_accounts FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM restaurant_customers c JOIN restaurants r ON r.id=c.restaurant_id
  WHERE c.id=customer_id AND (r.owner_id=auth.uid() OR public.is_super_admin()))
);
DROP POLICY IF EXISTS merchant_customer_account_bans ON public.restaurant_customer_account_bans;
CREATE POLICY merchant_customer_account_bans ON public.restaurant_customer_account_bans FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM restaurants r WHERE r.id=restaurant_id AND (r.owner_id=auth.uid() OR public.is_super_admin()))
);
CREATE OR REPLACE FUNCTION public.latest_customer_identity(p_restaurant_id UUID,p_phone TEXT,p_before TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(user_id UUID,order_id UUID,seen_at TIMESTAMPTZ,customer_name TEXT,customer_email TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN o.source='pos' OR o.customer_user_id=r.owner_id THEN NULL ELSE o.customer_user_id END,
  o.id,o.created_at,o.customer_name,o.customer_email
 FROM orders o JOIN restaurants r ON r.id=o.restaurant_id
 WHERE o.restaurant_id=p_restaurant_id AND o.customer_phone=p_phone
  AND (p_before IS NULL OR o.created_at<=p_before)
 ORDER BY o.created_at DESC,o.order_number DESC,o.id DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.latest_customer_identity(UUID,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
INSERT INTO public.restaurant_customer_accounts(customer_id,customer_user_id,last_order_id,last_seen_at)
 SELECT DISTINCT ON(c.id,o.customer_user_id) c.id,o.customer_user_id,o.id,o.created_at
 FROM restaurant_customers c JOIN orders o ON o.restaurant_id=c.restaurant_id AND o.customer_phone=c.customer_phone
 JOIN restaurants r ON r.id=c.restaurant_id
 WHERE o.customer_user_id IS NOT NULL AND coalesce(o.source,'')<>'pos' AND o.customer_user_id IS DISTINCT FROM r.owner_id
 ORDER BY c.id,o.customer_user_id,o.created_at DESC,o.order_number DESC,o.id DESC
 ON CONFLICT(customer_id,customer_user_id) DO NOTHING;
-- For an existing active ban, reconstruct the displayed identity at the time
-- of the ban. Do not bind all historical accounts sharing that phone.
WITH identities AS (
 SELECT c.id,i.* FROM restaurant_customers c LEFT JOIN LATERAL latest_customer_identity(c.restaurant_id,c.customer_phone,
  CASE WHEN c.is_banned AND (c.ban_expires_at IS NULL OR c.ban_expires_at>now()) THEN c.banned_at ELSE NULL END) i ON true
)
UPDATE restaurant_customers c SET customer_user_id=i.user_id,
 customer_name=coalesce(i.customer_name,c.customer_name),customer_email=coalesce(i.customer_email,c.customer_email)
 FROM identities i WHERE c.id=i.id;
INSERT INTO public.restaurant_customer_account_bans(restaurant_id,customer_user_id,customer_id,banned_reason,banned_at,ban_expires_at,banned_ip)
 SELECT DISTINCT ON(c.restaurant_id,c.customer_user_id) c.restaurant_id,c.customer_user_id,c.id,
 coalesce(c.banned_reason,''),coalesce(c.banned_at,now()),c.ban_expires_at,coalesce(c.banned_ip,'')
 FROM restaurant_customers c WHERE c.is_banned AND c.customer_user_id IS NOT NULL
 ORDER BY c.restaurant_id,c.customer_user_id,(c.ban_expires_at IS NULL) DESC,c.ban_expires_at DESC,c.banned_at DESC
 ON CONFLICT(restaurant_id,customer_user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.sync_customer_display_identity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE identity RECORD;
BEGIN
 IF TG_OP='UPDATE' AND OLD.customer_user_id IS NOT NULL AND NEW.customer_user_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.customer_user_id) THEN
  -- The FK clears a deleted account after delete_own_account anonymizes orders.
  -- Do not restore that vanished UID or move its ban to another phone sharer.
  -- An existing account still takes the frozen snapshot branch below.
  NEW.customer_name:='Compte supprime';
  NEW.customer_email:='';
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND OLD.is_banned AND (OLD.ban_expires_at IS NULL OR OLD.ban_expires_at>now()) THEN
  -- A pre-ban order can finish its contact upsert after the merchant's ban.
  -- Keep the displayed/banned snapshot stable until the ban is lifted.
  NEW.customer_user_id:=OLD.customer_user_id;
  NEW.customer_name:=OLD.customer_name;
  NEW.customer_email:=OLD.customer_email;
 ELSE
  SELECT * INTO identity FROM latest_customer_identity(NEW.restaurant_id,NEW.customer_phone);
  NEW.customer_user_id:=identity.user_id;
  IF identity.order_id IS NOT NULL THEN
   NEW.customer_name:=identity.customer_name;
   NEW.customer_email:=identity.customer_email;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_customer_display_identity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sync_customer_display_identity ON public.restaurant_customers;
CREATE TRIGGER sync_customer_display_identity BEFORE INSERT OR UPDATE ON public.restaurant_customers
 FOR EACH ROW EXECUTE FUNCTION public.sync_customer_display_identity();
CREATE OR REPLACE FUNCTION public.sync_customer_account_observations() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE identity RECORD; changed BOOLEAN;
BEGIN
 SELECT * INTO identity FROM latest_customer_identity(NEW.restaurant_id,NEW.customer_phone);
 IF identity.user_id IS NOT NULL THEN
  INSERT INTO restaurant_customer_accounts(customer_id,customer_user_id,last_order_id,last_seen_at)
  VALUES(NEW.id,identity.user_id,identity.order_id,identity.seen_at)
  ON CONFLICT(customer_id,customer_user_id) DO UPDATE SET last_order_id=EXCLUDED.last_order_id,last_seen_at=EXCLUDED.last_seen_at;
 END IF;
 changed:=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN
  changed:=OLD.is_banned IS DISTINCT FROM NEW.is_banned OR OLD.banned_reason IS DISTINCT FROM NEW.banned_reason
   OR OLD.ban_expires_at IS DISTINCT FROM NEW.ban_expires_at OR OLD.banned_ip IS DISTINCT FROM NEW.banned_ip;
 END IF;
 IF NEW.is_banned AND changed AND NEW.customer_user_id IS NOT NULL THEN
  INSERT INTO restaurant_customer_account_bans(restaurant_id,customer_user_id,customer_id,banned_reason,banned_at,ban_expires_at,banned_ip)
  VALUES(NEW.restaurant_id,NEW.customer_user_id,NEW.id,coalesce(NEW.banned_reason,''),coalesce(NEW.banned_at,now()),NEW.ban_expires_at,coalesce(NEW.banned_ip,''))
  ON CONFLICT(restaurant_id,customer_user_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,banned_reason=EXCLUDED.banned_reason,
   banned_at=EXCLUDED.banned_at,ban_expires_at=EXCLUDED.ban_expires_at,banned_ip=EXCLUDED.banned_ip;
 ELSIF TG_OP='UPDATE' AND OLD.is_banned AND NOT NEW.is_banned AND OLD.customer_user_id IS NOT NULL THEN
  DELETE FROM restaurant_customer_account_bans WHERE restaurant_id=OLD.restaurant_id AND customer_user_id=OLD.customer_user_id;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_customer_account_observations() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sync_customer_account_observations ON public.restaurant_customers;
CREATE TRIGGER sync_customer_account_observations AFTER INSERT OR UPDATE ON public.restaurant_customers
 FOR EACH ROW EXECUTE FUNCTION public.sync_customer_account_observations();
CREATE OR REPLACE FUNCTION public.enforce_customer_account_ban() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- auth.uid() remains authoritative even if a caller supplies a POS hint or
 -- a future ordering function stores a null order customer_user_id.
 IF EXISTS(SELECT 1 FROM restaurant_customer_account_bans b WHERE b.restaurant_id=NEW.restaurant_id
  AND b.customer_user_id=auth.uid() AND (b.ban_expires_at IS NULL OR b.ban_expires_at>now())) THEN
  RAISE EXCEPTION 'customer_banned' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_customer_account_ban() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS enforce_customer_account_ban ON public.orders;
CREATE TRIGGER enforce_customer_account_ban BEFORE INSERT ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_account_ban();
CREATE OR REPLACE FUNCTION public.set_restaurant_customer_ban(
 p_customer_id UUID,p_expected_user_id UUID,p_banned BOOLEAN,p_reason TEXT DEFAULT '',p_expires_at TIMESTAMPTZ DEFAULT NULL,p_ip TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE contact restaurant_customers; uid UUID:=auth.uid();
BEGIN
 SELECT * INTO contact FROM restaurant_customers WHERE id=p_customer_id FOR UPDATE;
 IF uid IS NULL OR NOT FOUND OR NOT EXISTS(SELECT 1 FROM restaurants r WHERE r.id=contact.restaurant_id
  AND (r.owner_id=uid OR public.is_super_admin())) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF contact.customer_user_id IS DISTINCT FROM p_expected_user_id THEN
  RAISE EXCEPTION 'customer_identity_changed' USING ERRCODE='22023';
 END IF;
 IF p_banned IS NULL OR length(coalesce(p_reason,''))>2000 OR length(coalesce(p_ip,''))>255 THEN
  RAISE EXCEPTION 'invalid_ban' USING ERRCODE='22023';
 END IF;
 IF p_expected_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM restaurant_customer_accounts a
  WHERE a.customer_id=p_customer_id AND a.customer_user_id=p_expected_user_id) THEN
  RAISE EXCEPTION 'customer_identity_changed' USING ERRCODE='22023';
 END IF;
 -- A ban/unban is an account decision. Update other currently blocked aliases
 -- of that same account as well, preserving other customers' contact bans.
 UPDATE restaurant_customers SET is_banned=p_banned,banned_at=CASE WHEN p_banned THEN now() ELSE NULL END,
  banned_reason=CASE WHEN p_banned THEN coalesce(p_reason,'') ELSE '' END,
  ban_expires_at=CASE WHEN p_banned THEN p_expires_at ELSE NULL END,
  banned_ip=CASE WHEN p_banned THEN coalesce(p_ip,'') ELSE '' END,updated_at=now()
 WHERE restaurant_id=contact.restaurant_id AND (id=p_customer_id OR
  (p_expected_user_id IS NOT NULL AND customer_user_id=p_expected_user_id AND is_banned));
 IF NOT p_banned AND p_expected_user_id IS NOT NULL THEN
  DELETE FROM restaurant_customer_account_bans WHERE restaurant_id=contact.restaurant_id AND customer_user_id=p_expected_user_id;
 END IF;
 RETURN jsonb_build_object('id',p_customer_id,'banned',p_banned,'customer_user_id',p_expected_user_id);
END; $$;
REVOKE ALL ON FUNCTION public.set_restaurant_customer_ban(UUID,UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_restaurant_customer_ban(UUID,UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TEXT) TO authenticated;
CREATE OR REPLACE FUNCTION public.check_customer_ban(p_restaurant_id UUID,p_phone TEXT,p_email TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result JSONB;
BEGIN
 SELECT jsonb_build_object('banned',true,'reason',banned_reason,'expires',ban_expires_at) INTO result
 FROM restaurant_customer_account_bans WHERE restaurant_id=p_restaurant_id AND customer_user_id=auth.uid()
  AND (ban_expires_at IS NULL OR ban_expires_at>now()) LIMIT 1;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT jsonb_build_object('banned',true,'reason',banned_reason,'expires',ban_expires_at) INTO result
 FROM restaurant_customers WHERE restaurant_id=p_restaurant_id AND is_banned AND (ban_expires_at IS NULL OR ban_expires_at>now())
  AND (customer_user_id=auth.uid() OR customer_phone=left(coalesce(p_phone,''),40)
  OR (nullif(lower(trim(coalesce(p_email,''))),'') IS NOT NULL AND lower(customer_email)=lower(trim(p_email)))) LIMIT 1;
 RETURN coalesce(result,jsonb_build_object('banned',false));
END; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
