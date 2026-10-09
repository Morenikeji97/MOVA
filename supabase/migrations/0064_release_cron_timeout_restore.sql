-- 0064 — restore the auto-release job's 15-second response timeout.
--
-- 0059 re-created the job from 0021's body and lost 0025's
-- `timeout_milliseconds := 15000`, so pg_net fell back to its 5-second
-- default. Since then most runs time out before shipmova.com answers
-- (net._http_response: 23 of 25 runs on 2026-10-07 timed out at 5000 ms;
-- the 2 that finished returned 200 {"released":0}).
--
-- Same job, schedule, URL and secret as now (0059); only the timeout comes
-- back. cron.schedule() with an existing name replaces it in place.

select cron.schedule(
  'release-abandoned-reservations',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://shipmova.com/api/cron/release-reservations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
