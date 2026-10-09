-- 0068 — landed-cost estimate rates, one row per destination country
-- (founder, 2026-10-09: "total delivered cost to Lagos/Tema/Lomé/Cotonou").
--
-- Replaces the never-merged Nigeria-only import_rates design from PR #33
-- with one simple shape for all four countries, editable by staff from a
-- phone (/admin/landed-cost):
--   duties and taxes as a low–high percent of CIF (customs value the car at
--   their own reference price, so this is a range, not a quote), insurance
--   for the CIF value, fixed customs fees, and port & clearing charges
--   (NULL = not included, because no source was found).
-- Every row says where its figures come from and when they were last checked.
--
-- New table only; nothing existing is changed. Public read (shown on
-- listing pages). Only an admin with the authenticator code (is_admin(),
-- 0048) can update; nobody inserts or deletes through the API. Saves are
-- audit-logged by the server action (admin_actions_log, 0056).

create table if not exists public.landed_cost_rates (
  country text primary key check (country in ('NG', 'GH', 'TG', 'BJ')),
  duties_min_pct numeric(5,2) not null check (duties_min_pct between 0 and 200),
  duties_max_pct numeric(5,2) not null check (duties_max_pct between 0 and 200),
  insurance_pct numeric(5,2) not null check (insurance_pct between 0 and 20),
  fixed_fees_usd numeric(10,2) not null default 0 check (fixed_fees_usd between 0 and 100000),
  port_clearing_min_usd numeric(10,2) check (port_clearing_min_usd between 0 and 100000),
  port_clearing_max_usd numeric(10,2) check (port_clearing_max_usd between 0 and 100000),
  source_note text not null check (char_length(source_note) between 1 and 2000),
  source_url text check (source_url is null or source_url ~ '^https://'),
  last_checked_on date not null,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  check (duties_max_pct >= duties_min_pct),
  check ((port_clearing_min_usd is null) = (port_clearing_max_usd is null)),
  check (port_clearing_max_usd is null or port_clearing_max_usd >= port_clearing_min_usd)
);

alter table public.landed_cost_rates enable row level security;

drop policy if exists "landed cost rates public read" on public.landed_cost_rates;
create policy "landed cost rates public read" on public.landed_cost_rates
  for select using (true);

drop policy if exists "landed cost rates admin update" on public.landed_cost_rates;
create policy "landed cost rates admin update" on public.landed_cost_rates
  for update using (public.is_admin()) with check (public.is_admin());

grant select on public.landed_cost_rates to anon, authenticated;
grant update on public.landed_cost_rates to authenticated;

-- Seed: published figures as of 2026-10-09 (lib/landed-cost.ts
-- DEFAULT_LANDED_COST_RATES is the same data, used if this can't be read).
-- None is confirmed by a clearing agent yet.
insert into public.landed_cost_rates (
  country, duties_min_pct, duties_max_pct, insurance_pct, fixed_fees_usd,
  port_clearing_min_usd, port_clearing_max_usd, source_note, source_url, last_checked_on
) values
  ('NG', 40, 45, 1.5, 0, 500, 1000,
   'Computed from published 2026 rates (Precebol Logistics; legit.ng, 27 Aug 2026): import duty 20%, NAC levy 5%, green tax 0–4% by engine size, surcharge 7% of duty, ETLS 0.5%, Customs FOB charge 4% of FOB, VAT 7.5% — about 40% (under 2.0L) to 45% (4.0L+) of CIF. Port & clearing $500–1,000 at Lagos. Not yet confirmed by a clearing agent.',
   'https://www.legit.ng/business-economy/industry/1725778-nigeria-car-import-rules-2026-cars-import-age-limit-lhd-rule-levies/',
   '2026-10-09'),
  ('GH', 31, 49, 1.5, 0, null, null,
   'Computed from published 2026 components (GRA guidance via kitannex.com, guazi.com, ascopeshipping.co.uk): import duty 5% (under 1.0L), 10% (1.0–3.0L) or 20% (over 3.0L); ECOWAS 0.5%, EXIM 0.75%, AU 0.2%, special import levy 2%, examination fee 1%, withholding tax 1% of CIF; VAT 15% + NHIL 2.5% + GETFund 2.5% of CIF plus duty — about 31% to 49% of CIF. Cars over 10 years old pay an extra over-age penalty. Port & clearing at Tema: no source found, not included. Not yet confirmed by a clearing agent.',
   'https://kitannex.com/knowledge-base/customs',
   '2026-10-09'),
  ('TG', 44, 53, 1.5, 0, 450, 1050,
   'Published estimate (actulome.com, 19 Jun 2026): duties + VAT about 44–53% of CIF at Lomé (TEC customs duty, statistical fee ~1%, community levies, VAT 18% on CIF plus duties). Transit/clearance for a used sedan 400–900 € (about $450–1,050). Not yet confirmed by a clearing agent.',
   'https://actulome.com/importer-voiture-etranger-togo-taxes-couts/',
   '2026-10-09'),
  ('BJ', 32, 40, 1.5, 175, 975, 975,
   'Published estimate (adtranslogistics.com, 2026 guide): duties and taxes about 32% of CIF for a standard car or SUV, about 40% for large engines, at Cotonou; fixed levies 98,600 XOF per declaration (about $175); handling, formalities and registration about 550,000 XOF (about $975). Not yet confirmed by a clearing agent.',
   'https://www.adtranslogistics.com/guides/dedouanement-vehicule-benin-2026',
   '2026-10-09')
on conflict (country) do nothing;
