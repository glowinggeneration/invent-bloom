CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('always-on-daily-plan') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'always-on-daily-plan');
SELECT cron.unschedule('always-on-publish-due') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'always-on-publish-due');

SELECT cron.schedule(
  'always-on-daily-plan',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://project--9109f686-339e-417e-8f02-4cc5ee32daae.lovable.app/api/public/hooks/always-on',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_ZhaswiLy51UBtCy0W8NazQ_gWGXzH2q"}'::jsonb,
    body:='{"action": "plan"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'always-on-publish-due',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--9109f686-339e-417e-8f02-4cc5ee32daae.lovable.app/api/public/hooks/always-on',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_ZhaswiLy51UBtCy0W8NazQ_gWGXzH2q"}'::jsonb,
    body:='{"action": "publish"}'::jsonb
  );
  $$
);