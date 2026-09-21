-- MOVA — Title-ownership verification: authorized-seller path + audit trail
--
-- Extends the title-photo/identity-match checklist already built in 0023
-- (public.vehicles.title_photo_path / title_identity_match_confirmed, the
-- private vehicle-title-photos bucket, and the
-- vehicles_title_identity_confirmed_before_approval CHECK). That work
-- already covers most of "close the list-a-car-you-don't-own gap": a
-- required title upload, an admin-only confirmation column, and RLS scoped
-- to owner-or-admin. This migration adds what was still missing:
--
--   1. The title upload is now actually REQUIRED before a listing can reach
--      'pending_review' (previously title_photo_path was nullable with no
--      enforcement at all — a listing could be submitted, and even
--      approved, with no title photo).
--   2. A seller who isn't the titled owner can declare that
--      (not_titled_owner) and upload a second document — an authorization
--      letter / POA — required before review in that case, reusing the
--      same private bucket and ownership-via-path RLS as the title photo
--      (see the doc comment on that bucket in 0023 — same sensitivity
--      level, no reason for a second bucket).
--   3. title_identity_match_confirmed gets a real audit trail
--      (confirmed_by/confirmed_at), and — new — a fresh title/authorization
--      upload or a not_titled_owner flip now RESETS that confirmation, so
--      an admin's already-recorded "yes this matches" can't silently go
--      stale against a swapped-in document. Same "a new submission starts a
--      fresh review cycle" reasoning as bank-transfer-proof re-upload
--      clearing prior review fields (0014).
--
-- NOT DONE HERE: the user's request described this as going into "the
-- existing vehicle_documents bucket" — that table (public.vehicle_documents,
-- 0001_init.sql) and its `doc_type`/`doc_visibility` enums are Phase-0
-- scaffold with zero references anywhere in app/ (grepped) and no actual
-- Supabase Storage bucket behind them; reviving a dead, differently-shaped
-- table instead of extending 0023's already-live, already-tested mechanism
-- would mean two parallel document-storage systems for no benefit. This
-- migration extends the real one instead.

-- 0. seller_profiles.full_name: was inert display data with no writer
-- anywhere in the app (no profile-completion UI exists — see the buyer/
-- seller verification-flow notes) and, as such, was never locked by
-- seller_profiles_guard_admin_only_fields (0010): "seller profile owner
-- write" is a broad `for all using (user_id = auth.uid())` RLS policy with
-- no column-level check, so a seller could already self-set full_name to
-- anything via a raw PATCH. That was harmless while nothing read the
-- column. Now that the Stripe Identity webhook populates it with the
-- verified legal name and the admin review screen displays it as exactly
-- that ("Stripe-Identity-verified legal name") for a side-by-side
-- name-vs-title comparison, a self-writable full_name would let a seller
-- fake the very thing the check exists to catch — so it needs the same
-- admin/service-role-only lock as id_verification_status.
create or replace function public.seller_profiles_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'unverified';
    new.id_verified_at := null;
    new.full_name := null;
    if new.id_verification_status <> 'pending' then
      new.id_verification_status := 'unverified';
    end if;
    return new;
  end if;

  new.verification_status := old.verification_status;
  new.id_verified_at := old.id_verified_at;
  new.full_name := old.full_name;
  if new.id_verification_status <> 'pending' then
    new.id_verification_status := old.id_verification_status;
  end if;
  return new;
end;
$$;

-- 1. New columns ---------------------------------------------------------
alter table public.vehicles
  add column not_titled_owner boolean not null default false,
  add column authorization_document_path text,
  add column title_identity_match_confirmed_by uuid references public.users(id),
  add column title_identity_match_confirmed_at timestamptz;

-- 2. Backfill: any listing already sitting in 'pending_review' without a
-- title photo can't satisfy the new CHECK constraint added below — kick it
-- back to 'draft' rather than leaving it stuck in a state the DB will no
-- longer accept a no-op update against. This does NOT touch already-
-- 'approved' listings (see 0023's own precedent of grandfathering those
-- rather than retroactively enforcing a new gate against a live listing).
--
-- vehicles_guard_admin_only_fields (0007/0009/0023) only allows a non-admin
-- 'draft' -> 'pending_review' transition and reverts any other status
-- change — including this exact backfill, since a migration session has no
-- admin JWT/auth.uid(). Disable it for just this one statement, same as
-- any migration that needs to write a value its own guard trigger would
-- otherwise revert.
alter table public.vehicles disable trigger vehicles_guard_admin_only_fields;

update public.vehicles
  set status = 'draft'
  where status = 'pending_review' and title_photo_path is null;

alter table public.vehicles enable trigger vehicles_guard_admin_only_fields;

-- 3. Extend the guard trigger: protect the two new audit columns the same
-- way title_identity_match_confirmed already is, and reset all three when a
-- seller's own write changes the documents or ownership declaration that
-- confirmation was actually based on. not_titled_owner and
-- authorization_document_path themselves stay seller-writable (same trust
-- level as title_photo_path — not admin-decision fields), so neither is
-- added to the revert list below.
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
    new.verification_status := 'unverified';
    new.title_history_check_status := 'not_run';
    new.title_identity_match_confirmed := false;
    new.title_identity_match_confirmed_by := null;
    new.title_identity_match_confirmed_at := null;
    new.rejection_reason := null;
    new.status := 'draft';
    return new;
  end if;

  if new.title_photo_path is distinct from old.title_photo_path
     or new.not_titled_owner is distinct from old.not_titled_owner
     or new.authorization_document_path is distinct from old.authorization_document_path
  then
    -- The documents (or the ownership declaration) an existing
    -- confirmation was based on just changed — that confirmation no longer
    -- means anything, so it's cleared rather than preserved.
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

  if not (old.status = 'draft' and new.status = 'pending_review') then
    new.status := old.status;
  end if;

  return new;
end;
$$;

-- 4. Require the documents before a listing can reach 'pending_review' —
-- not retroactive against already-'approved'/'draft'/'rejected' rows, same
-- shape as vehicles_title_identity_confirmed_before_approval (0023).
alter table public.vehicles
  add constraint vehicles_title_photo_required_before_review
  check (status <> 'pending_review' or title_photo_path is not null);

alter table public.vehicles
  add constraint vehicles_authorization_doc_required_before_review
  check (
    status <> 'pending_review'
    or not not_titled_owner
    or authorization_document_path is not null
  );
