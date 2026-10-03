\set ON_ERROR_STOP on
-- Build this local fixture table after running scale-onboarding.sql with pgbench.
CREATE TABLE IF NOT EXISTS public.qa_scale_catalog(id UUID PRIMARY KEY,client_id INTEGER UNIQUE);
INSERT INTO qa_scale_catalog(id,client_id)
SELECT r.id,i FROM generate_series(0,99) i JOIN restaurants r ON r.onboarding_key=md5('scale-onboarding-'||i)::uuid ON CONFLICT(id) DO NOTHING;
GRANT SELECT ON qa_scale_catalog TO authenticated;
