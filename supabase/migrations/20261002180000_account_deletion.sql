BEGIN;
CREATE OR REPLACE FUNCTION public.delete_own_account(p_confirmation TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE uid UUID := auth.uid(); account_email TEXT;
BEGIN
  IF uid IS NULL OR p_confirmation IS DISTINCT FROM 'DELETE' THEN
    RAISE EXCEPTION 'confirmation_required' USING ERRCODE='42501';
  END IF;
  SELECT email INTO account_email FROM auth.users WHERE id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM subscriptions s JOIN restaurants r ON r.id=s.restaurant_id
    WHERE r.owner_id=uid AND coalesce(s.stripe_subscription_id,'')<>'' AND s.status IN ('active','past_due')) THEN
    RAISE EXCEPTION 'cancel_subscription_before_deletion' USING ERRCODE='22023';
  END IF;
  -- Financial/order records remain, with the deleted customer's identity removed.
  UPDATE orders SET customer_name='Compte supprime',customer_phone='',customer_email='',
    customer_address='',client_ip=NULL,customer_user_id=NULL,notes=''
    WHERE customer_user_id=uid;
  DELETE FROM restaurant_customers WHERE lower(customer_email)=lower(account_email);
  -- Close owned pages without purging other customers' order records.
  UPDATE restaurants SET owner_id=NULL,account_status='archived',is_accepting_orders=false,
    deactivated_at=now(),restaurant_phone=NULL,onboarding_key=NULL WHERE owner_id=uid;
  DELETE FROM auth.users WHERE id=uid;
  RETURN jsonb_build_object('deleted',true);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_own_account(TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account(TEXT) TO authenticated;
COMMIT;
