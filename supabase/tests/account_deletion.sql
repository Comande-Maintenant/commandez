BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(7);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('10000000-0000-0000-0000-000000000011','delete1@example.test',now()),
('10000000-0000-0000-0000-000000000012','delete2@example.test',now());
INSERT INTO restaurants(id,name,slug,owner_id) VALUES
('30000000-0000-0000-0000-000000000011','My Restaurant','delete-owned','10000000-0000-0000-0000-000000000011'),
('30000000-0000-0000-0000-000000000012','Other Restaurant','delete-other','10000000-0000-0000-0000-000000000012');
INSERT INTO customer_profiles(id,email,name) VALUES('10000000-0000-0000-0000-000000000011','delete1@example.test','Delete Me');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000011',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT extensions.throws_ok($$SELECT delete_own_account('wrong')$$,'42501','confirmation_required','explicit confirmation required');
SELECT extensions.is((SELECT count(*)::int FROM auth.users WHERE id='10000000-0000-0000-0000-000000000011'),1,'confirmation error preserves account');
SELECT extensions.lives_ok($$SELECT delete_own_account('DELETE')$$,'confirmed deletion succeeds');
SELECT extensions.is((SELECT count(*)::int FROM auth.users WHERE id='10000000-0000-0000-0000-000000000011'),0,'authentication account removed');
SELECT extensions.is((SELECT count(*)::int FROM customer_profiles WHERE id='10000000-0000-0000-0000-000000000011'),0,'profile removed');
SELECT extensions.is((SELECT account_status FROM restaurants WHERE slug='delete-owned'),'archived','owned business closed without purging order records');
SELECT extensions.is((SELECT count(*)::int FROM auth.users WHERE id='10000000-0000-0000-0000-000000000012'),1,'other account preserved');
SELECT * FROM extensions.finish();
ROLLBACK;
