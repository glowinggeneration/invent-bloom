-- The public maintenance hooks (api/public/hooks/*) used to be authenticated
-- with the Supabase anon/publishable key, which ships in every client bundle
-- and is not a secret. The app code now requires a real shared secret
-- (LOVABLE_CRON_SECRET) via `Authorization: Bearer <secret>`. Reschedule the
-- two cron jobs defined in this repo to send that header instead.
--
-- Before this migration runs, set the secret in Postgres so the cron jobs can
-- read it without hardcoding it in source control:
--   ALTER DATABASE postgres SET app.lovable_cron_secret = '<the same value as LOVABLE_CRON_SECRET>';
-- (or store it in Supabase Vault and swap the current_setting() call below for
-- a vault lookup.)

SELECT cron.unschedule('fkf-daily-report') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fkf-daily-report');
SELECT cron.unschedule('always-on-daily-plan') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'always-on-daily-plan');
SELECT cron.unschedule('always-on-publish-due') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'always-on-publish-due');

SELECT cron.schedule(
  'fkf-daily-report',
  '55 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9109f686-339e-417e-8f02-4cc5ee32daae.lovable.app/api/public/hooks/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.lovable_cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'always-on-daily-plan',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9109f686-339e-417e-8f02-4cc5ee32daae.lovable.app/api/public/hooks/always-on',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.lovable_cron_secret', true)
    ),
    body := '{"action": "plan"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'always-on-publish-due',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9109f686-339e-417e-8f02-4cc5ee32daae.lovable.app/api/public/hooks/always-on',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.lovable_cron_secret', true)
    ),
    body := '{"action": "publish"}'::jsonb
  );
  $$
);
