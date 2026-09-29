-- MOVA — waitlist: seller signups, and the new pages the form lives on.
--
-- Additive and safe with the previous app build (it only sends the old
-- source values and never sets audience).
--
-- Privileges, for the record: 0039 granted INSERT to anon/authenticated on
-- the five form columns only (email, whatsapp, country, vehicle_id,
-- source), not on the table. has_table_privilege(..., 'INSERT') therefore
-- reports false even though a real insert of those columns succeeds — use
-- has_column_privilege to check. The column list is deliberate: it keeps id
-- and created_at server-assigned, so a public caller can't backdate a
-- signup. The new column is granted the same way.
--
-- SELECT stays granted to authenticated: /admin/waitlist and the admin
-- dashboard count read through the admin's own session, and the
-- "waitlist admin read" RLS policy limits rows to admins.

alter table public.waitlist_signups
  add column audience text not null default 'buyer'
    check (audience in ('buyer', 'seller'));

alter table public.waitlist_signups
  drop constraint waitlist_signups_source_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_source_check
    check (source in ('site', 'listing', 'dashboard', 'home', 'how_it_works', 'browse', 'sell'));

grant insert (audience) on public.waitlist_signups to anon, authenticated;
