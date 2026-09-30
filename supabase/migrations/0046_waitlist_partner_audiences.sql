-- ShipMova — waitlist for partners: shippers, inspectors, clearing agents.
--
-- /inspectors and /clearing-agents collect "register your interest" signups
-- through the same insert-only waitlist table. Additive and safe with the
-- previous app build.

-- 1. Who, and from where ----------------------------------------------------
alter table public.waitlist_signups
  drop constraint waitlist_signups_audience_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_audience_check
    check (audience in ('buyer', 'seller', 'shipper', 'inspector', 'clearing_agent'));

alter table public.waitlist_signups
  drop constraint waitlist_signups_source_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_source_check
    check (source in ('site', 'listing', 'dashboard', 'home', 'how_it_works', 'browse', 'sell',
                      'shipper', 'inspectors', 'clearing_agents'));

-- 2. Partner details (all optional at the database level; the forms decide
--    which are required for which audience — lib/prelaunch.ts) ------------
alter table public.waitlist_signups
  add column full_name text check (full_name is null or length(full_name) between 1 and 120),
  add column company text check (company is null or length(company) between 1 and 160),
  add column city_state text check (city_state is null or length(city_state) between 1 and 120),
  add column experience text check (experience is null or length(experience) between 1 and 1000),
  add column ports_served text[] check (
    ports_served is null or ports_served <@ array['Apapa', 'Tin Can Island', 'Onne']::text[]
  ),
  add column license_number text check (license_number is null or length(license_number) between 1 and 80);

-- 3. Still insert-only for the public, column by column (see 0039/0041) ---
grant insert (full_name, company, city_state, experience, ports_served, license_number)
  on public.waitlist_signups to anon, authenticated;
