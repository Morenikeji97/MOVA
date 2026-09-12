-- MOVA — Partial VIN display + admin VIN verification badge
--
-- (1) Partial VIN masking, enforced at the query/API level, not just the UI.
--     `vehicles.vin` keeps storing the full VIN as-is; what changes is who is
--     allowed to read the raw column. SELECT on that column is revoked from
--     `anon`/`authenticated`, so a raw REST call (e.g. GET
--     .../vehicles?select=vin with the anon key) is denied outright rather
--     than merely un-rendered by our UI. The only supported read path is the
--     `vehicle_vin_display` computed column below, backed by a SECURITY
--     DEFINER function that decides full vs. masked per row/caller:
--       - admins (public.is_admin())
--       - the listing's own seller (seller_id = auth.uid())
--       - a buyer whose reservation has had MOVA's fee paid and seller
--         details revealed — the same unlock point already used for seller
--         contact info (purchase_requests.mova_fee_payment_status = 'paid'
--         and seller_details_revealed_at is not null)
--     get the full VIN; everyone else gets the masked form (last 6 chars).
--
-- (2) vin_verification_status: set manually by admin after running NICB
--     VINCheck / NMVTIS lookups outside the app (no live API integration
--     yet). A 'flagged' listing can never be approved — enforced by a CHECK
--     constraint (belt) and the admin approve action's own filter (braces).
--     A trigger keeps this column admin-only: a seller's own insert/update
--     on their listing (allowed broadly by the existing "vehicles seller
--     update own" RLS policy) can't set or change it, even via a direct API
--     call that bypasses the app's UI.

create type vin_verification_status as enum ('unverified', 'verified', 'flagged');

alter table public.vehicles
  add column vin_verification_status vin_verification_status not null default 'unverified';

alter table public.vehicles
  add constraint vehicles_flagged_not_approved
  check (not (status = 'approved' and vin_verification_status = 'flagged'));

-- Keeps the last `keep` characters of `vin`, replacing the rest with one
-- bullet per masked character. Defensive about null/short values (dev/test
-- VINs) rather than erroring.
create or replace function public.mask_vin(vin text, keep int default 6)
returns text
language sql
immutable
as $$
  select case
    when vin is null then null
    when length(vin) <= keep then vin
    else repeat('•', length(vin) - keep) || right(vin, keep)
  end;
$$;

-- Computed column: `select id, vehicle_vin_display from vehicles`, or via
-- PostgREST `?select=vehicle_vin_display`. SECURITY DEFINER so it can read
-- the raw vin column on the caller's behalf even though anon/authenticated
-- no longer have direct column privilege on it.
create or replace function public.vehicle_vin_display(v public.vehicles)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then v.vin
    when v.seller_id = auth.uid() then v.vin
    when exists (
      select 1 from public.purchase_requests pr
      where pr.vehicle_id = v.id
        and pr.buyer_id = auth.uid()
        and pr.mova_fee_payment_status = 'paid'
        and pr.seller_details_revealed_at is not null
    ) then v.vin
    else public.mask_vin(v.vin)
  end;
$$;

revoke select (vin) on public.vehicles from anon, authenticated;
grant execute on function public.mask_vin(text, int) to anon, authenticated;
grant execute on function public.vehicle_vin_display(public.vehicles) to anon, authenticated;

create or replace function public.vehicles_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.vin_verification_status := 'unverified';
  else
    new.vin_verification_status := old.vin_verification_status;
  end if;
  return new;
end;
$$;

create trigger vehicles_guard_admin_only_fields
  before insert or update on public.vehicles
  for each row execute procedure public.vehicles_guard_admin_only_fields();
