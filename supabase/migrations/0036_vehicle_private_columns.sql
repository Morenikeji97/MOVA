-- MOVA — actually hide vehicles.vin, title_photo_path and
-- authorization_document_path from the anon key.
--
-- 0007 ran `revoke select (vin) on public.vehicles from anon, authenticated`
-- intending to make a raw `GET /rest/v1/vehicles?select=vin` fail. It never
-- did: anon/authenticated also hold table-level SELECT on vehicles, and a
-- column-level REVOKE cannot subtract from a table-level GRANT. Anyone with
-- the public anon key could read the full VIN of every approved listing.
-- The two document paths (private-bucket object keys, which embed the
-- seller's uid) were never protected at all.
--
-- The fix is the pattern shippers already uses (0004/0016/0029): revoke the
-- table-level grant, then grant SELECT back column by column, leaving these
-- three out.
--
-- That breaks PostgREST computed columns. PostgREST invokes one as
-- fn(vehicles), a whole-row reference, and Postgres requires SELECT on
-- every column for that — so vehicle_vin_display, vehicle_has_title_document,
-- vehicle_has_authorization_document and vehicle_seller_identity_verified
-- would all start failing with "permission denied for table vehicles". They
-- are replaced by real columns:
--
--   vin_masked                   stored generated from mask_vin(vin)
--   has_title_document           stored generated from title_photo_path
--   has_authorization_document   stored generated from authorization_document_path
--   seller_identity_verified     trigger-maintained from seller_profiles
--
-- Stored generated columns can't be written by anyone — Postgres rejects any
-- value but DEFAULT in an INSERT or UPDATE, for every role — so a seller
-- can't set the first three through the API. seller_identity_verified is a
-- plain column, so vehicles_guard_admin_only_fields now derives it from
-- seller_profiles on every write instead of trusting the incoming value.
--
-- The full VIN is read through public.vehicle_vin(id), which checks the
-- caller itself. The document paths are read server-side with the secret
-- key, after an admin role check (app/admin/listings/page.tsx).
--
-- This migration is additive only and safe to run while the previous app
-- build (which still selects the computed columns) is live. The revoke and
-- the drop of the old computed functions are in 0037, applied once the app
-- code that stops using them has shipped.

-- 1. Replacement columns ---------------------------------------------------
alter table public.vehicles
  add column vin_masked text
    generated always as (public.mask_vin(vin, 6)) stored,
  add column has_title_document boolean not null
    generated always as (title_photo_path is not null) stored,
  add column has_authorization_document boolean not null
    generated always as (authorization_document_path is not null) stored,
  add column seller_identity_verified boolean not null default false;

-- The single definition of "seller has cleared identity verification".
create or replace function public.seller_is_identity_verified(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seller_profiles sp
    where sp.user_id = p_seller_id
      and sp.id_verification_status = 'verified'
  );
$$;

revoke execute on function public.seller_is_identity_verified(uuid) from public, anon, authenticated;

-- Backfill. The guard below would recompute it anyway; this keeps the
-- backfill independent of who runs the migration.
--
-- Rows whose VIN fails vin_is_valid are skipped here and in the sync
-- trigger below: vehicles_vin_valid (0034) is NOT VALID, so those legacy
-- rows are tolerated but any UPDATE to them is refused. They stay at false
-- (no "Verified Listing" badge), which is the conservative answer for a
-- listing with a bad VIN anyway.
alter table public.vehicles disable trigger vehicles_guard_admin_only_fields;
update public.vehicles v
   set seller_identity_verified = public.seller_is_identity_verified(v.seller_id)
 where public.vin_is_valid(v.vin);
alter table public.vehicles enable trigger vehicles_guard_admin_only_fields;

-- 2. Guard trigger ---------------------------------------------------------
--
-- Same as 0035, plus seller_identity_verified: derived from seller_profiles
-- on every INSERT/UPDATE by anyone, admin included. It's a fact about
-- another table, never an input, so there's no case where the incoming
-- value should win.
--
-- The generated columns are deliberately not mentioned: they can't be
-- assigned by any role, and Postgres doesn't allow reading them in a BEFORE
-- trigger anyway.
create or replace function public.vehicles_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  documents_changed boolean := false;
  archiving boolean := false;
begin
  new.seller_identity_verified := public.seller_is_identity_verified(new.seller_id);

  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.vin_verification_status := 'unverified';
    new.verification_status := 'unverified';
    new.title_history_check_status := 'not_run';
    new.title_identity_match_confirmed := false;
    new.title_identity_match_confirmed_by := null;
    new.title_identity_match_confirmed_at := null;
    new.rejection_reason := null;
    new.status := 'draft';
    return new;
  end if;

  documents_changed :=
    new.title_photo_path is distinct from old.title_photo_path
    or new.not_titled_owner is distinct from old.not_titled_owner
    or new.authorization_document_path is distinct from old.authorization_document_path;

  if documents_changed then
    new.title_identity_match_confirmed := false;
    new.title_identity_match_confirmed_by := null;
    new.title_identity_match_confirmed_at := null;
  else
    new.title_identity_match_confirmed := old.title_identity_match_confirmed;
    new.title_identity_match_confirmed_by := old.title_identity_match_confirmed_by;
    new.title_identity_match_confirmed_at := old.title_identity_match_confirmed_at;
  end if;

  new.vin_verification_status := old.vin_verification_status;
  new.verification_status := old.verification_status;
  new.title_history_check_status := old.title_history_check_status;
  new.rejection_reason := old.rejection_reason;

  -- Seller-initiated withdrawal. Raises rather than silently reverting,
  -- because the seller asked for something specific and needs to know it
  -- didn't happen — unlike the catch-all revert below, which exists to
  -- neutralise writes the seller never intended to make.
  archiving := new.status = 'archived'
    and old.status in ('draft', 'pending_review', 'approved', 'rejected');

  if archiving and public.vehicle_has_active_buyer(old.id) then
    raise exception 'vehicle_has_active_buyer'
      using errcode = 'check_violation',
            hint = 'This car has an active buyer, contact MOVA on WhatsApp to cancel.';
  end if;

  if archiving then
    new.status := 'archived';
  elsif documents_changed and old.status = 'approved' then
    new.status := 'pending_review';
  elsif not (old.status = 'draft' and new.status = 'pending_review') then
    new.status := old.status;
  end if;

  return new;
end;
$$;

-- Keep seller_identity_verified current when a seller's verification
-- changes (Stripe Identity webhook, admin action). The UPDATE only touches
-- rows whose value is actually wrong; the guard above recomputes the value
-- itself, so what's written here is only a trigger to re-derive.
create or replace function public.seller_profiles_sync_vehicle_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  verified boolean := new.id_verification_status = 'verified';
begin
  update public.vehicles
     set seller_identity_verified = verified
   where seller_id = new.user_id
     and seller_identity_verified is distinct from verified
     -- See the backfill note: an invalid-VIN legacy row can't be updated,
     -- and failing here would fail the seller_profiles write with it.
     and public.vin_is_valid(vin);
  return null;
end;
$$;

revoke execute on function public.seller_profiles_sync_vehicle_identity() from public, anon, authenticated;

create trigger seller_profiles_sync_vehicle_identity
  after insert or update of id_verification_status on public.seller_profiles
  for each row execute procedure public.seller_profiles_sync_vehicle_identity();

-- 3. Full VIN, permission-checked in the function ------------------------
--
-- Same audience as 0007's vehicle_vin_display: an admin, the listing's own
-- seller, or a buyer whose MOVA fee is paid and who has had seller details
-- revealed. Everyone else — including anon, other sellers and unpaid
-- buyers — gets NULL, not the masked VIN, so a caller can't mistake one for
-- the other; vin_masked is the column for that.
create or replace function public.vehicle_vin(p_vehicle_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select v.vin
  from public.vehicles v
  where v.id = p_vehicle_id
    and auth.uid() is not null
    and (
      public.is_admin()
      or v.seller_id = auth.uid()
      or exists (
        select 1 from public.purchase_requests pr
        where pr.vehicle_id = v.id
          and pr.buyer_id = auth.uid()
          and pr.mova_fee_payment_status = 'paid'
          and pr.seller_details_revealed_at is not null
      )
    );
$$;

revoke execute on function public.vehicle_vin(uuid) from public, anon;
grant execute on function public.vehicle_vin(uuid) to authenticated;
