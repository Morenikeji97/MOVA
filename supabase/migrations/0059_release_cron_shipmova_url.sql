-- 0059 — point the reservation auto-release job at shipmova.com.
--
-- Since 2026-09-29 (netlify.toml 301-redirects mova-marketplace.netlify.app
-- to shipmova.com) every run of 'release-abandoned-reservations' has failed:
-- pg_net doesn't follow the redirect's POST, and the endpoint answers 405.
-- So abandoned reservations haven't been released automatically.
--
-- cron.schedule() with an existing job name replaces that job's schedule and
-- command in place (pg_cron ≥ 1.3) — nothing is dropped; the secret stays in
-- Vault. Same schedule, same body; only the URL changes.

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
    body := '{}'::jsonb
  );
  $$
);
