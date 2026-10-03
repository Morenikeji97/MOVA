-- Nigerian import-charge rates for the listing page's landed-cost estimate,
-- editable by staff from /admin/import-rates instead of living in code.
--
-- One row per destination country (Nigeria only for now). Rates are stored
-- as fractions (0.20 = 20%). Anyone can read them — they're shown on public
-- listing pages. Only an admin (is_admin(), which requires a two-step
-- sign-in since 0048) can update; nobody inserts or deletes through the
-- API. Every save is written to admin_actions_log by the server action.

create table public.import_rates (
  country text primary key check (country in ('NG')),
  import_duty_rate numeric(6,4) not null check (import_duty_rate between 0 and 1),
  nac_levy_rate numeric(6,4) not null check (nac_levy_rate between 0 and 1),
  green_tax_under_2l_rate numeric(6,4) not null check (green_tax_under_2l_rate between 0 and 1),
  green_tax_2_to_4l_rate numeric(6,4) not null check (green_tax_2_to_4l_rate between 0 and 1),
  green_tax_4l_plus_rate numeric(6,4) not null check (green_tax_4l_plus_rate between 0 and 1),
  surcharge_rate_of_duty numeric(6,4) not null check (surcharge_rate_of_duty between 0 and 1),
  etls_rate numeric(6,4) not null check (etls_rate between 0 and 1),
  fob_charge_rate numeric(6,4) not null check (fob_charge_rate between 0 and 1),
  vat_rate numeric(6,4) not null check (vat_rate between 0 and 1),
  insurance_rate numeric(6,4) not null check (insurance_rate between 0 and 1),
  port_clearing_min_usd numeric(10,2) not null check (port_clearing_min_usd >= 0),
  port_clearing_max_usd numeric(10,2) not null,
  source_note text check (char_length(source_note) <= 1000),
  last_verified_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  check (port_clearing_max_usd >= port_clearing_min_usd)
);

alter table public.import_rates enable row level security;

create policy "import rates public read" on public.import_rates
  for select using (true);

create policy "import rates admin update" on public.import_rates
  for update using (public.is_admin()) with check (public.is_admin());

grant select on public.import_rates to anon, authenticated;
grant update on public.import_rates to authenticated;

-- The 2026 published rates the estimator launched with (lib/landed-cost.ts
-- DEFAULT_NG_RATES). Staff confirm or correct them with clearing agents.
insert into public.import_rates (
  country, import_duty_rate, nac_levy_rate,
  green_tax_under_2l_rate, green_tax_2_to_4l_rate, green_tax_4l_plus_rate,
  surcharge_rate_of_duty, etls_rate, fob_charge_rate, vat_rate, insurance_rate,
  port_clearing_min_usd, port_clearing_max_usd, source_note, last_verified_at
) values (
  'NG', 0.20, 0.05,
  0, 0.02, 0.04,
  0.07, 0.005, 0.04, 0.075, 0.015,
  500, 1000,
  'Published 2026 rates (Precebol Logistics; legit.ng 27 Aug 2026). Not yet confirmed by a clearing agent.',
  '2026-10-03T00:00:00Z'
);
