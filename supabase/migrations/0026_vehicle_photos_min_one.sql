-- MOVA — Enforce at least one photo per vehicle
--
-- Backstops the new seller "edit photos" flow (app/seller/listings/[id]/photos):
-- the app-level check in updateListingPhotos() is the primary UX ("you need
-- at least one photo"), but this is a genuine data-integrity invariant, so
-- it gets a DB-level guard too, same as every other stated invariant in this
-- codebase (vehicles_flagged_not_approved, vehicles_title_identity_confirmed_
-- before_approval, etc.) — RLS restricts vehicle_photos writes to the owning
-- seller (or admin), but nothing stops a raw REST call bypassing the app.
--
-- STATEMENT-level trigger with a transition table (not a per-row trigger):
-- a per-row BEFORE/AFTER DELETE trigger checking "is this vehicle now at
-- zero?" independently for each deleted row would misfire on a legitimate
-- multi-row DELETE (e.g. deleting 3 of a vehicle's 3 rows in one statement)
-- — the statement-level check runs once after the whole DELETE, using
-- old_rows to know which vehicle_ids were touched, then checks each one's
-- ACTUAL remaining count.
--
-- SEQUENCING THIS REQUIRES: updateListingPhotos() must insert new photos
-- and update kept ones BEFORE deleting removed ones, never delete-then-
-- insert — otherwise a legitimate "swap all photos" edit would transiently
-- hit zero rows and this trigger would reject it. See that action's own
-- comment for the exact order.
create or replace function public.vehicle_photos_prevent_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id uuid;
begin
  for v_vehicle_id in select distinct vehicle_id from old_rows loop
    -- Skip the check when the vehicle itself is gone too (its own row's
    -- ON DELETE CASCADE just removed all of its photos as a side effect —
    -- that's a whole-listing deletion, not "edit this listing down to zero
    -- photos", and by this point in the cascade the parent row is already
    -- gone from this transaction's view).
    if exists (select 1 from public.vehicles where id = v_vehicle_id)
       and not exists (select 1 from public.vehicle_photos where vehicle_id = v_vehicle_id)
    then
      raise exception 'A listing must have at least one photo.';
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists vehicle_photos_prevent_empty_trigger on public.vehicle_photos;
create trigger vehicle_photos_prevent_empty_trigger
  after delete on public.vehicle_photos
  referencing old table as old_rows
  for each statement
  execute function public.vehicle_photos_prevent_empty();
