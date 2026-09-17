-- MOVA — Abandoned-reservation auto-release: scheduler
--
-- Runs every 15 minutes, close enough to the 24h mark that no reservation
-- sits abandoned for much longer than the requirement allows.
--
-- WHY pg_cron + pg_net calling an API route, rather than a bare pg_cron SQL
-- job doing the UPDATE directly: purchase_requests_guard_negotiation
-- (0011/0018/0020) is a BEFORE UPDATE trigger whose fallback branch reverts
-- to OLD for any caller that isn't recognized as admin/service-role/the
-- row's own buyer or seller. A raw pg_cron job runs as a Postgres role with
-- no `auth.role()`/`auth.uid()` JWT context at all, so it would match none
-- of those branches and its UPDATE would be silently discarded — no error,
-- just no effect. Routing through the Next.js API route instead reuses the
-- same createAdminClient() (service-role JWT) path the Stripe webhooks
-- already use, which the trigger's `auth.role() = 'service_role'` branch
-- correctly recognizes. The actual timeout rule lives in TypeScript
-- (lib/auto-release.ts) so it's unit-tested by the existing `npm test`
-- suite, not duplicated in SQL.
--
-- SECRET: the cron job authenticates to the route with a bearer token read
-- from Supabase Vault (never a literal in this file, since migrations are
-- committed to git). One-time setup, run once via the SQL editor / MCP
-- execute_sql, not part of this migration:
--   select vault.create_secret('<same value as Netlify CRON_SECRET env var>', 'cron_secret');
--
-- URL: production origin is mova-marketplace.netlify.app (see
-- NEXT_PUBLIC_APP_URL in .env.example / lib/app-url.ts). Update the url
-- below if the production domain ever changes.

create extension if not exists pg_cron;
create extension if not exists pg_net;

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
    body := '{}'::jsonb
  );
  $$
);
