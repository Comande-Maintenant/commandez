BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

DO $schedule$
DECLARE
  existing_job_id BIGINT;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('cleanup-demo-orders', 'trial-reminders-daily')
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'cleanup-demo-orders',
    '0 */4 * * *',
    'SELECT public.cleanup_demo_orders()'
  );

  PERFORM cron.schedule(
    'trial-reminders-daily',
    '0 3 * * *',
    $command$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'commandeici_project_url'
        ) || '/functions/v1/trial-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'commandeici_cron_secret'
          )
        ),
        body := '{}'::jsonb
      ) AS request_id
    $command$
  );
END;
$schedule$;

COMMIT;
