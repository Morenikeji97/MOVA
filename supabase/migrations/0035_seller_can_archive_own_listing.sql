-- MOVA — a seller can take their own listing down.
--
-- vehicles_guard_admin_only_fields has, since 0007/0009/0023/0031, allowed a
-- non-admin exactly one status transition: 'draft' -> 'pending_review'
-- (0033 added a second, documents-swapped -> 'pending_review'). Every other
-- status change by a non-admin was silently reverted to the old value, which
-- meant a seller had no way to withdraw a listing at all: a live car that had
-- sold elsewhere, been wrecked, or been listed by mistake stayed on /browse
-- until an admin intervened. Note "silently" — the guard reverts rather than
-- raising, so the seller's UPDATE returned success while changing nothing.
--
-- This adds the seller-initiated withdrawal path:
--
--   draft | pending_review | approved | rejected  ->  archived
--
-- and nothing else. Specifically still admin-only:
--   - any path to 'approved' (a seller cannot publish their own listing)
--   - any path to 'sold' (that's a transaction outcome, not a seller claim)
--   - un-archiving: 'archived' -> anything is reverted for a non-admin, so a
--     withdrawn listing can't quietly reappear without a fresh admin review
--   - 'sold' -> 'archived': a completed sale is not withdrawn after the fact
--
-- RLS is unchanged and still does the ownership half of the job: "vehicles
-- seller update own" restricts UPDATE to seller_id = auth.uid() (or admin),
-- so this trigger only ever decides WHICH transition is legal, never WHOSE
-- row it is.
--
-- Blocked while a buyer is mid-transaction — see
-- public.vehicle_has_active_buyer below.

-- 1. "Active buyer" ------------------------------------------------------
--
-- A reservation still in flight. 'submitted' / 'under_review' / 'verified'
-- is the same "still open" set the abandoned-reservation cron (0020) and
-- lib/auto-release.ts already use, so there's one definition of a live
-- reservation in the system rather than two.
--
-- The fee clause is deliberately separate and deliberately redundant today:
-- any paid or awaiting-verification fee currently sits on a request in one
-- of those three states, but stating it explicitly means a later change to
-- the status flow can't quietly make it possible to archive a car someone
-- has already paid MOVA for. 'completed' is excluded — the sale is done, and
-- such a vehicle is 'sold' anyway, which has no seller archive path.
--
-- SECURITY DEFINER: a seller can read purchase_requests for their own
-- vehicles ("purchase requests read"), so this doesn't hand them anything
-- new; it's definer so the trigger's verdict can't depend on the caller's
-- visibility.
create or replace function public.vehicle_has_active_buyer(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.purchase_requests pr
    where pr.vehicle_id = p_vehicle_id
      and (
        pr.status in ('submitted', 'under_review', 'verified')
        or (
          pr.mova_fee_payment_status in ('paid', 'pending_manual_verification')
          and pr.status <> 'completed'
        )
      )
  );
$$;

revoke execute on function public.vehicle_has_active_buyer(uuid) from public;
grant execute on function public.vehicle_has_active_buyer(uuid) to authenticated;

-- 2. The guard trigger ---------------------------------------------------
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
