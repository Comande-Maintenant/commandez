\set ON_ERROR_STOP on
-- Run only in the isolated functional-test PostgreSQL container.
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
SELECT md5('scaleowner-'||i)::uuid,'scale-owner-'||i||'@example.test',now(),'{"role":"owner","is_owner":true}'::jsonb FROM generate_series(0,99) i ON CONFLICT(id) DO NOTHING;
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
SELECT md5('scalecustomer-'||i)::uuid,'scale-'||i||'@example.test',now(),'{"role":"customer"}'::jsonb FROM generate_series(0,99) i ON CONFLICT(id) DO NOTHING;
