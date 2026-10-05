-- Rollback for migration 0058_buyer_id_at_signup.sql — restores the database
-- exactly as it was on 2026-10-05 before 0058 ran.
--
-- Backup taken 2026-10-05 of the only pre-existing object 0058 changes:
-- public.buyer_profiles_guard_admin_only_fields(), md5 of its definition
-- a39c59d988d1c821525ca8550c6e8fb8. Everything else 0058 creates was new,
-- so rolling back just removes it.
--
-- Run as the database owner (Supabase SQL editor), in one transaction.
-- Data note: the id_* columns are dropped, so any ID-check results recorded
-- after 0058 (country, method, legal name, review notes) would be lost —
-- export them first if any real buyer has verified.

begin;

-- 1. The guard function, exactly as before 0058.
create or replace function public.buyer_profiles_guard_admin_only_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.nin_verification_status := 'unverified';
    new.bvn_verification_status := 'unverified';
    new.verification_status := 'unverified';
    new.policy_accepted_at := case when new.policy_version is not null then now() else null end;
    return new;
  end if;

  new.nin_verification_status := old.nin_verification_status;
  new.bvn_verification_status := old.bvn_verification_status;
  new.verification_status := old.verification_status;

  if new.policy_version is not null and new.policy_version is distinct from old.policy_version then
    new.policy_accepted_at := now();
  else
    new.policy_version := old.policy_version;
    new.policy_accepted_at := old.policy_accepted_at;
  end if;

  return new;
end;
$function$;

-- 2. Objects 0058 added (none existed before).
drop function if exists public.buyer_id_summary(uuid);
drop policy if exists "buyer id documents owner insert" on storage.objects;
drop policy if exists "buyer id documents owner delete" on storage.objects;
-- The bucket can only be removed once empty: delete any uploaded ID photos
-- through the Storage API (dashboard → Storage → buyer-id-documents) first.
delete from storage.buckets where id = 'buyer-id-documents';

alter table public.buyer_profiles
  drop column if exists id_country,
  drop column if exists id_method,
  drop column if exists id_legal_name,
  drop column if exists id_record_name,
  drop column if exists id_name_match,
  drop column if exists id_document_type,
  drop column if exists id_document_path,
  drop column if exists id_review_note,
  drop column if exists id_reviewed_by,
  drop column if exists id_reviewed_at,
  drop column if exists id_verified_at;

-- 3. Check: should print a39c59d988d1c821525ca8550c6e8fb8.
select md5(pg_get_functiondef('public.buyer_profiles_guard_admin_only_fields'::regproc));

commit;
