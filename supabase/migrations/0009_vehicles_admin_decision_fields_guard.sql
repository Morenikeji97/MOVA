-- MOVA — close the RLS gap on "vehicles seller update own" (and the
-- matching "vehicles seller insert" policy): both allow a seller to write
-- any column on their own row with no `with check`, which means a seller
-- could self-approve a listing (status='approved'), clear a rejection,
-- mark verification_status/title_history_check_status as done, etc. via a
-- direct API call — not just through the app's own admin-gated actions.
--
-- Extends the same admin-only-field trigger already guarding
-- vin_verification_status (migration 0007) to cover the other
-- admin-decision columns: status, verification_status, rejection_reason,
-- and title_history_check_status. Sellers keep exactly the one status
-- transition the app relies on them making themselves — draft ->
-- pending_review, i.e. "submit for review" — every other change to these
-- columns is silently reverted to its prior value, same as the existing
-- vin_verification_status behavior.

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
    new.rejection_reason := null;
    new.status := 'draft';
    return new;
  end if;

  new.vin_verification_status := old.vin_verification_status;
  new.verification_status := old.verification_status;
  new.title_history_check_status := old.title_history_check_status;
  new.rejection_reason := old.rejection_reason;

  -- The one seller-driven transition the app makes (submitForReview).
  -- Anything else — self-approving, un-rejecting, reverting to draft,
  -- jumping straight to sold/archived, etc. — is reverted.
  if not (old.status = 'draft' and new.status = 'pending_review') then
    new.status := old.status;
  end if;

  return new;
end;
$$;
