-- MOVA — model-year code for the import badge, one active listing per
-- VIN, and no approval without a photo.
--
-- Additive and safe with the previous app build.

-- 1. VIN position 10 (model-year code) -----------------------------------
--
-- The import-eligibility badge (lib/import-rules.ts) needs the model year
-- on listing cards, which only get vin_masked (the last 6 characters —
-- position 10 isn't among them) because the raw vin is column-restricted
-- (0037). This exposes that one character and nothing else; the model year
-- is shown on the listing anyway. Decoding stays in lib/import-rules.ts so
-- there's one implementation.
alter table public.vehicles
  add column vin_model_year_code text
    generated always as (upper(substr(vin, 10, 1))) stored;

-- 0037: new vehicles columns aren't readable until granted.
grant select (vin_model_year_code) on public.vehicles to anon, authenticated;

-- 2. One non-archived listing per VIN --------------------------------------
--
-- Case-insensitive, and only among listings that aren't archived, so a car
-- withdrawn and listed again (or sold on and relisted after archiving) is
-- fine. Checked before this migration: no existing non-archived duplicates.
-- The seller form maps the violation (23505 on this index) to "This VIN is
-- already listed on MOVA".
create unique index vehicles_vin_active_unique
  on public.vehicles (upper(vin))
  where status <> 'archived';

-- 3. No approval without at least one photo --------------------------------
--
-- For everyone, admins included: the admin UI disables Approve when a
-- listing has no photos, and this is the backstop for a hand-crafted
-- request. vehicle_photos_prevent_empty (0026) already stops the last photo
-- being deleted; this stops a photoless listing going live in the first
-- place. Named to run after vehicles_guard_admin_only_fields (trigger order
-- is alphabetical), so it sees the status that guard settles on.
create or replace function public.vehicles_require_photo_to_approve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and not exists (select 1 from public.vehicle_photos p where p.vehicle_id = new.id)
  then
    raise exception 'listing_has_no_photos'
      using errcode = 'check_violation',
            hint = 'A listing needs at least one photo before it can be approved.';
  end if;
  return new;
end;
$$;

revoke execute on function public.vehicles_require_photo_to_approve() from public, anon, authenticated;

create trigger vehicles_require_photo_to_approve
  before insert or update on public.vehicles
  for each row execute procedure public.vehicles_require_photo_to_approve();
