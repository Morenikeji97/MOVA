-- The last good USD exchange rates, for the local-currency prices shown next
-- to dollar prices (lib/fx.ts).
--
-- Rates come from open.er-api.com, fetched at most once an hour. Each
-- successful fetch upserts here; when a fetch fails, the site shows these
-- stored rates with their own "updated" time instead of nothing.
--
-- Written and read only with the service role: RLS is on with no policies,
-- so the publishable key can't touch it.

create table public.fx_rates (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  usd_rate numeric not null check (usd_rate > 0),
  provider_updated_at timestamptz not null,
  fetched_at timestamptz not null default now()
);

alter table public.fx_rates enable row level security;

revoke all on public.fx_rates from anon, authenticated;
