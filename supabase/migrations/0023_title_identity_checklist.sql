-- MOVA — Title-photo upload + admin identity-match checklist
--
-- Manual, checklist-style enforcement: admin can't approve a listing without
-- (a) the VIN check being off 'flagged' (already enforced since 0007) and
-- (b) explicitly confirming the seller's uploaded title photo matches their
-- Stripe-Identity-verified name. No API integration here — same spirit as
-- the existing VIN check, which is also just an admin-recorded outcome of a
-- lookup performed outside the app.
--
-- title_photo_path: seller-writable, same trust level as price/description
-- (not an admin-decision field) — set once at listing creation, holding a
-- path (not a public URL) since the bucket below is private.
--
-- title_identity_match_confirmed: admin-only, same column-level-guard idiom
-- as vin_verification_status — the existing vehicles_guard_admin_only_fields
-- trigger (0007/0009) is extended in place to also protect this column.

alter table public.vehicles
  add column title_photo_path text,
  add column title_identity_match_confirmed boolean not null default false;

-- Grandfather any already-approved listing before the guard trigger below
-- starts protecting this column — same idiom as 0018's vehicle_size_type
-- backfill. There's exactly one such row today; going forward every new
-- approval must pass through the real admin confirmation. This MUST run
-- before the CREATE OR REPLACE below: once the trigger knows about
-- title_identity_match_confirmed, it reverts any writer it doesn't
-- recognize as admin/service-role (including this migration's own
-- superuser session, which has no auth.uid()) back to the old value.
update public.vehicles
  set title_identity_match_confirmed = true
  where status = 'approved';

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
    new.rejection_reason := null;
    new.status := 'draft';
    return new;
  end if;

  new.vin_verification_status := old.vin_verification_status;
  new.verification_status := old.verification_status;
  new.title_history_check_status := old.title_history_check_status;
  new.title_identity_match_confirmed := old.title_identity_match_confirmed;
  new.rejection_reason := old.rejection_reason;

  if not (old.status = 'draft' and new.status = 'pending_review') then
    new.status := old.status;
  end if;

  return new;
end;
$$;

-- Same shape as vehicles_flagged_not_approved (0007) — a listing can't be
-- 'approved' until admin has ticked the identity-match confirmation.
alter table public.vehicles
  add constraint vehicles_title_identity_confirmed_before_approval
  check (not (status = 'approved' and title_identity_match_confirmed = false));

-- Private bucket — a title document is sensitive (owner name, address, VIN),
-- not listing media. 10 MiB, images or a PDF, same limits as
-- bank-transfer-proofs (0014). Object key: <seller uid>/<uuid>.<ext> — no
-- vehicle_id in the path (unlike bank-transfer-proofs) because the vehicle
-- row doesn't exist yet at upload time, same reason vehicle-videos (0012)
-- keys on seller-uid alone.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-title-photos',
  'vehicle-title-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicle title photos owner insert" on storage.objects;
create policy "vehicle title photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-title-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle title photos owner update" on storage.objects;
create policy "vehicle title photos owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vehicle-title-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'vehicle-title-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle title photos owner delete" on storage.objects;
create policy "vehicle title photos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-title-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Read: the owning seller or an admin (unlike vehicle-videos, this bucket is
-- private — a title document isn't listing media).
drop policy if exists "vehicle title photos owner read" on storage.objects;
create policy "vehicle title photos owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vehicle-title-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or public.is_admin()
    )
  );
