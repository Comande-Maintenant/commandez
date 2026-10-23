BEGIN;
-- The dashboard reads only these columns. Sending and preference changes
-- remain service-only; authenticated users cannot promote themselves.
GRANT SELECT (id,email_type,recipient_email,sent_at) ON public.email_logs TO authenticated;
GRANT SELECT (id,unsubscribed_at) ON public.user_email_preferences TO authenticated;

DROP POLICY IF EXISTS super_admin_email_logs_read ON public.email_logs;
CREATE POLICY super_admin_email_logs_read ON public.email_logs
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS super_admin_email_preferences_read ON public.user_email_preferences;
CREATE POLICY super_admin_email_preferences_read ON public.user_email_preferences
  FOR SELECT TO authenticated USING (public.is_super_admin());
NOTIFY pgrst, 'reload schema';
COMMIT;
