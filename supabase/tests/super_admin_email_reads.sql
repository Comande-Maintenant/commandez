\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
CREATE TEMP TABLE admin_email_tap(result text);
CREATE TEMP TABLE admin_email_probes(label text,emails bigint,prefs bigint,is_admin boolean,can_update_log boolean,can_update_prefs boolean);
GRANT INSERT ON admin_email_probes TO authenticated;
INSERT INTO admin_email_tap SELECT extensions.plan(13);

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  ('23000000-0000-4000-8000-000000000001','admin-email-scope@example.test',now()),
  ('23000000-0000-4000-8000-000000000002','owner-email-scope@example.test',now());
INSERT INTO public.owners(id,email,phone,role) VALUES
  ('23000000-0000-4000-8000-000000000001','admin-email-scope@example.test','','super_admin'),
  ('23000000-0000-4000-8000-000000000002','owner-email-scope@example.test','','owner');
INSERT INTO public.email_logs(id,user_id,email_type,recipient_email) VALUES
  ('23000000-0000-4000-8000-000000000003','23000000-0000-4000-8000-000000000002','authorization_fixture','owner-email-scope@example.test');
INSERT INTO public.user_email_preferences(id,user_id,unsubscribed_at) VALUES
  ('23000000-0000-4000-8000-000000000004','23000000-0000-4000-8000-000000000002',now());

SELECT set_config('request.jwt.claims','{"sub":"23000000-0000-4000-8000-000000000002","role":"authenticated"}',true),
  set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
INSERT INTO pg_temp.admin_email_probes SELECT 'owner',
  (SELECT count(id) FROM public.email_logs WHERE id='23000000-0000-4000-8000-000000000003'),
  (SELECT count(id) FROM public.user_email_preferences WHERE id='23000000-0000-4000-8000-000000000004'),
  public.is_super_admin(),has_table_privilege(current_user,'public.email_logs','UPDATE'),
  has_table_privilege(current_user,'public.user_email_preferences','UPDATE');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated"}',true),
  set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
INSERT INTO pg_temp.admin_email_probes SELECT 'admin',
  (SELECT count(id) FROM public.email_logs WHERE id='23000000-0000-4000-8000-000000000003'),
  (SELECT count(id) FROM public.user_email_preferences WHERE id='23000000-0000-4000-8000-000000000004'),
  public.is_super_admin(),has_table_privilege(current_user,'public.email_logs','UPDATE'),
  has_table_privilege(current_user,'public.user_email_preferences','UPDATE');
RESET ROLE;

INSERT INTO admin_email_tap SELECT extensions.is((SELECT emails FROM admin_email_probes WHERE label='owner'),0::bigint,'ordinary owner cannot read email logs');
INSERT INTO admin_email_tap SELECT extensions.is((SELECT prefs FROM admin_email_probes WHERE label='owner'),0::bigint,'ordinary owner cannot read the preference rows');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT (SELECT is_admin FROM admin_email_probes WHERE label='owner'),'owner is not a super-admin');
INSERT INTO admin_email_tap SELECT extensions.is((SELECT emails FROM admin_email_probes WHERE label='admin'),1::bigint,'super-admin reads the email fixture');
INSERT INTO admin_email_tap SELECT extensions.is((SELECT prefs FROM admin_email_probes WHERE label='admin'),1::bigint,'super-admin reads the preference fixture');
INSERT INTO admin_email_tap SELECT extensions.ok((SELECT is_admin FROM admin_email_probes WHERE label='admin'),'super-admin identity is enforced');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT EXISTS(SELECT 1 FROM admin_email_probes WHERE can_update_log),'no authenticated role can edit email logs');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT EXISTS(SELECT 1 FROM admin_email_probes WHERE can_update_prefs),'no authenticated role can change preferences');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT has_column_privilege('authenticated','public.owners','role','UPDATE'),'clients cannot promote themselves');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT has_column_privilege('anon','public.email_logs','recipient_email','SELECT'),'anonymous users cannot read recipients');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT has_column_privilege('anon','public.user_email_preferences','id','SELECT'),'anonymous users cannot read preferences');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT has_column_privilege('authenticated','public.email_logs','metadata','SELECT'),'unneeded log metadata remains private');
INSERT INTO admin_email_tap SELECT extensions.ok(NOT has_column_privilege('authenticated','public.user_email_preferences','user_id','SELECT'),'unneeded preference identity column remains private');
INSERT INTO admin_email_tap SELECT * FROM extensions.finish();
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM admin_email_tap WHERE result LIKE 'not ok%' OR result LIKE '# Looks like%') THEN
    RAISE EXCEPTION 'super_admin_email_reads failed: %',(SELECT string_agg(result,E'\n') FROM admin_email_tap);
  END IF;
END $$;
SELECT result FROM admin_email_tap;
ROLLBACK;
