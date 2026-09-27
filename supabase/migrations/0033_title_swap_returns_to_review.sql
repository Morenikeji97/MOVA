-- MOVA — a swapped title/authorization document sends a live listing back to
-- review instead of being rejected outright.
--
-- FOUND BY ACTUALLY RUNNING PR #18's UNCHECKED TEST
--
-- 0031 added: "a fresh title/authorization upload or a not_titled_owner flip
-- now RESETS that confirmation, so an admin's already-recorded 'yes this
-- matches' can't silently go stale against a swapped-in document." PR #18's
-- test plan listed "confirm that swapping either document post-confirmation
-- resets the checkbox" as an unchecked box, and it turns out that path never
-- worked on an approved listing:
--
--   vehicles_guard_admin_only_fields (0031) clears
--   title_identity_match_confirmed when the documents change, but
--   vehicles_title_identity_confirmed_before_approval (0023) forbids
--   status='approved' with title_identity_match_confirmed=false. On a live
--   listing the two rules contradict each other, so the seller's UPDATE is
--   refused with
--
--     23514: new row for relation "vehicles" violates check constraint
--            "vehicles_title_identity_confirmed_before_approval"
--
--   i.e. a seller could not replace the title on their own approved listing
--   at all, and the "confirmation goes stale" protection 0031 advertised was
--   dead code for exactly the listings where it mattered most.
--
-- Resolution: keep both invariants and make the transition explicit. Swapping
-- the documents under a live listing is a new submission, so it returns to
-- 'pending_review' for a fresh admin look — the same "a new submission starts
-- a fresh review cycle" reasoning 0031 itself cites from the bank-transfer
-- proof re-upload flow (0014). The listing drops out of /browse until an
-- admin re-confirms and re-approves, which is the conservative direction: a
-- listing whose title just changed should not keep advertising a review of
-- the previous document.
--
-- 'sold' is deliberately excluded — a completed sale isn't sent back into the
-- review queue by a late document edit. 'draft'/'pending_review'/'rejected'
-- need no status change: the confirmation reset alone is already legal there.

create or replace function public.vehicles_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  documents_changed boolean := false;
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
    -- The documents (or the ownership declaration) an existing confirmation
    -- was based on just changed — that confirmation no longer means
    -- anything, so it's cleared rather than preserved.
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

  -- Status: a non-admin may submit their own draft for review, and — new
  -- here — a document swap under a live listing sends it back to review
  -- rather than being rejected by the approved-implies-confirmed constraint.
  if documents_changed and old.status = 'approved' then
    new.status := 'pending_review';
  elsif not (old.status = 'draft' and new.status = 'pending_review') then
    new.status := old.status;
  end if;

  return new;
end;
$$;
