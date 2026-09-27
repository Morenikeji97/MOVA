-- MOVA — Badge integrity: a verification badge may only reflect a check that
-- actually happened.
--
-- WHY THIS EXISTS
--
-- A live listing (2003 Honda Accord, VIN 1HGCM82633A004352) rendered both
-- "Verified Listing" and "Title reviewed" on /browse/[id] while its row said
-- verification_status='unverified', vin_verification_status='unverified' and
-- title_photo_path IS NULL. Two independent defects produced that:
--
--   1. title_identity_match_confirmed was true on a row with no title
--      document at all. Source: migration 0023's grandfather backfill
--
--        update public.vehicles
--          set title_identity_match_confirmed = true
--          where status = 'approved';
--
--      which keyed purely off status and never checked whether a title had
--      been uploaded. That listing was already 'approved' when 0023 ran (it
--      predates the title-photo requirement entirely — 0031 is what finally
--      made the upload mandatory, and it deliberately grandfathered
--      already-approved rows), so it was handed a confirmation nobody ever
--      performed. The tell-tale is title_identity_match_confirmed_by /
--      _at being NULL: the real admin path (setTitleIdentityMatchConfirmed
--      in app/admin/listings/actions.ts) always stamps both, and 0023 ran
--      before those columns existed.
--
--   2. "Verified Listing" on /browse/[id] read no field whatsoever — it was
--      an unconditional <VerifiedBadge />. Since that page only renders
--      approved listings, the badge effectively meant status = 'approved'.
--
-- Note for the record: PR #18's "lazy, self-healing backfill" is NOT
-- implicated. That one lives in app/admin/listings/page.tsx and only ever
-- writes seller_profiles.full_name (from Stripe Identity); it never touches
-- title_identity_match_confirmed. It has been left alone.
--
-- WHAT THIS MIGRATION DOES
--
--   1. Resets every title confirmation that has no document behind it.
--   2. Adds a CHECK constraint so the state can never be re-created —
--      including by a future backfill written the way 0023's was.
--   3. Adds the computed columns the badge rules need, so every surface can
--      evaluate the same rule without a public listing card having to select
--      private document paths or the seller's profile row.

-- 1. Cleanup -------------------------------------------------------------
--
-- vehicles_guard_admin_only_fields pins title_identity_match_confirmed to
-- its OLD value for any writer it doesn't recognise as admin, and a
-- migration session has no auth.uid(), so this update would otherwise be
-- silently reverted. Same disable/enable idiom as 0031's own backfill.
alter table public.vehicles disable trigger vehicles_guard_admin_only_fields;

update public.vehicles
  set title_identity_match_confirmed = false,
      title_identity_match_confirmed_by = null,
      title_identity_match_confirmed_at = null
  where title_identity_match_confirmed
    and not (
      title_identity_match_confirmed_at is not null
      and (
        title_photo_path is not null
        or (not_titled_owner and authorization_document_path is not null)
      )
    );

alter table public.vehicles enable trigger vehicles_guard_admin_only_fields;

-- 2. Make it structurally impossible ------------------------------------
--
-- Deliberately identical to hasTitleReviewedBadge() in lib/listing-badges.ts
-- so the DB invariant and the badge rule cannot drift: a confirmation needs
-- a timestamp AND a document it could plausibly have been made against.
-- Validated (not NOT VALID) — step 1 just guaranteed zero violating rows,
-- and a constraint that isn't enforced against existing rows would leave
-- exactly the hole this closes.
alter table public.vehicles
  add constraint vehicles_title_confirmation_requires_document
  check (
    not title_identity_match_confirmed
    or (
      title_identity_match_confirmed_at is not null
      and (
        title_photo_path is not null
        or (not_titled_owner and authorization_document_path is not null)
      )
    )
  );

-- 3. Computed columns for the badge rules -------------------------------
--
-- Same PostgREST computed-column idiom as vehicle_vin_display (0007):
-- selectable as `?select=vehicle_seller_identity_verified`.
--
-- Document *presence* is exposed as a boolean rather than by letting public
-- surfaces select title_photo_path / authorization_document_path. A browse
-- card needs to know "is there a title on file", not where it lives — and
-- those paths are keyed by the seller's uid and point into a private
-- bucket, so there's no reason to hand them to anonymous visitors.
create or replace function public.vehicle_has_title_document(v public.vehicles)
returns boolean
language sql
stable
set search_path = public
as $$
  select v.title_photo_path is not null;
$$;

create or replace function public.vehicle_has_authorization_document(v public.vehicles)
returns boolean
language sql
stable
set search_path = public
as $$
  select v.authorization_document_path is not null;
$$;

-- SECURITY DEFINER: "seller profile owner read" RLS confines
-- seller_profiles to the owner or an admin, so a buyer browsing a listing
-- cannot read the seller's verification state directly. The only thing this
-- discloses is the single boolean the "Verified Listing" badge needs —
-- whether the seller cleared Stripe Identity — not the profile row, the
-- legal name, or the provider reference.
--
-- id_verification_status is the real signal here. seller_profiles.
-- verification_status is Phase-0 scaffold with no writer anywhere in the
-- app (grepped) and sits at 'unverified' for every existing row, as does
-- vehicles.verification_status — which is exactly why the badge rules must
-- not be built on either of them.
create or replace function public.vehicle_seller_identity_verified(v public.vehicles)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seller_profiles sp
    where sp.user_id = v.seller_id
      and sp.id_verification_status = 'verified'
  );
$$;

grant execute on function public.vehicle_has_title_document(public.vehicles) to anon, authenticated;
grant execute on function public.vehicle_has_authorization_document(public.vehicles) to anon, authenticated;
grant execute on function public.vehicle_seller_identity_verified(public.vehicles) to anon, authenticated;
