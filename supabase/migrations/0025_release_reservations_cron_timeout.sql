-- MOVA — Fix the abandoned-reservation cron's HTTP timeout
--
-- Every 15-minute tick since 0021 was applied has actually failed: pg_net's
-- default net.http_post timeout (observed empirically at ~5000ms on this
-- project) wasn't enough for the Netlify function's cold-start latency —
-- nothing else hits /api/cron/release-reservations between ticks, so it
-- cold-starts every single time, consistently taking just over 5s and
-- timing out. Confirmed via net._http_response: two consecutive ticks both
-- show `timed_out: true` at ~4.9s, right at the default ceiling.
--
-- Re-schedules the same job (cron.schedule upserts by jobname, so this is
-- jobid 1 updated in place, not a duplicate) with an explicit
-- timeout_milliseconds well above that cold-start cost.

select cron.schedule(
  'release-abandoned-reservations',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://mova-marketplace.netlify.app/api/cron/release-reservations',
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
