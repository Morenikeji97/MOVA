-- MOVA — waitlist: add the United States as a country.
--
-- Sellers are U.S.-based, and the seller version of the waitlist form had
-- no country for them — a U.S. number typed without "+1" under "Other"
-- was stored as "1631…" with no way to tell its country. The app now offers
-- US and turns every number into "+<country code><number>"
-- (lib/prelaunch.ts toInternationalWhatsapp).
--
-- Additive: the previous app build never sends 'US'.

alter table public.waitlist_signups
  drop constraint waitlist_signups_country_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_country_check
    check (country in ('NG', 'GH', 'TG', 'BJ', 'US', 'OTHER'));
