-- Prerequisite: create these two values in Supabase Vault during deployment.
-- Do not commit the schedule-secret value to source control.
--   gipo_project_url: https://<project-ref>.supabase.co
--   gipo_schedule_secret: the value of the GIPO_SCHEDULE_SECRET Edge Function secret

select cron.schedule(
  'gipo-follow-up-dispatch',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'gipo_project_url') || '/functions/v1/follow-up-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gipo-schedule-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gipo_schedule_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
)
where not exists (
  select 1 from cron.job where jobname = 'gipo-follow-up-dispatch'
);
