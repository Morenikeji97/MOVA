-- Buyers verify their ID at sign-up (founder's decision, 2026-10-05).
--
-- A buyer account isn't usable (no member browsing, chat or reserving)
-- until buyer_profiles.verification_status = 'verified' (middleware.ts and
-- the server actions; reserving is also refused in the database once the
-- 0057 switch is on). No selfies.
--   Nigeria: NIN looked up through Dojah; the name the buyer typed must
--            match the government record (small spelling/order differences
--            allowed — lib/name-match.ts). A mismatch goes to admin review.
--   Ghana:   Ghana Card through Dojah, same name rule.
--   Togo / Benin: a photo of a national ID or passport, reviewed by an admin.
-- 'pending' = waiting for admin review. ShipMova never stores an ID number
-- (or Dojah's photo); for a name mismatch it keeps the record's name so the
-- reviewer can compare.
--
-- Every new column is written only by the server (service role) or an
-- admin: the guard trigger blanks them on a buyer's own insert and pins them
-- on a buyer's own update (the owner-write gap pattern, 0010).

alter table public.buyer_profiles
  add column if not exists id_country text check (id_country in ('NG', 'GH', 'TG', 'BJ')),
  add column if not exists id_method text check (id_method in ('ng_nin', 'gh_card', 'document')),
  add column if not exists id_legal_name text check (char_length(id_legal_name) <= 200),
  add column if not exists id_record_name text check (char_length(id_record_name) <= 200),
  add column if not exists id_name_match text check (id_name_match in ('match', 'close', 'mismatch')),
  add column if not exists id_document_type text check (id_document_type in ('national_id', 'passport')),
  add column if not exists id_document_path text,
  add column if not exists id_review_note text check (char_length(id_review_note) <= 1000),
  add column if not exists id_reviewed_by uuid,
  add column if not exists id_reviewed_at timestamptz,
  add column if not exists id_verified_at timestamptz;

-- buyer_profiles_guard_admin_only_fields(): the live body plus the id_* columns.
create or replace function public.buyer_profiles_guard_admin_only_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.nin_verification_status := 'unverified';
    new.bvn_verification_status := 'unverified';
    new.verification_status := 'unverified';
    new.policy_accepted_at := case when new.policy_version is not null then now() else null end;
    new.id_country := null;
    new.id_method := null;
    new.id_legal_name := null;
    new.id_record_name := null;
    new.id_name_match := null;
    new.id_document_type := null;
    new.id_document_path := null;
    new.id_review_note := null;
    new.id_reviewed_by := null;
    new.id_reviewed_at := null;
    new.id_verified_at := null;
    return new;
  end if;

  new.nin_verification_status := old.nin_verification_status;
  new.bvn_verification_status := old.bvn_verification_status;
  new.verification_status := old.verification_status;
  new.id_country := old.id_country;
  new.id_method := old.id_method;
  new.id_legal_name := old.id_legal_name;
  new.id_record_name := old.id_record_name;
  new.id_name_match := old.id_name_match;
  new.id_document_type := old.id_document_type;
  new.id_document_path := old.id_document_path;
  new.id_review_note := old.id_review_note;
  new.id_reviewed_by := old.id_reviewed_by;
  new.id_reviewed_at := old.id_reviewed_at;
  new.id_verified_at := old.id_verified_at;

  if new.policy_version is not null and new.policy_version is distinct from old.policy_version then
    new.policy_accepted_at := now();
  else
    new.policy_version := old.policy_version;
    new.policy_accepted_at := old.policy_accepted_at;
  end if;

  return new;
end;
$$;

-- Private bucket for Togo/Benin ID photos. Buyers upload into their own
-- folder; nobody reads them through the API (admins get short-lived signed
-- links from the server).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('buyer-id-documents', 'buyer-id-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "buyer id documents owner insert" on storage.objects;
create policy "buyer id documents owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'buyer-id-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "buyer id documents owner delete" on storage.objects;
create policy "buyer id documents owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'buyer-id-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- What a seller may see about a buyer: a summary of what was checked, never
-- the ID number, record name or document. Only for the buyer themselves, an
-- admin, or a seller who has a conversation or reservation with that buyer.
create or replace function public.buyer_id_summary(p_buyer_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when b.verification_status <> 'verified' then 'ID not verified yet'
    when b.id_method = 'ng_nin' and b.id_name_match in ('match', 'close')
      then 'Nigerian NIN verified — name matches government record'
    when b.id_method = 'ng_nin' then 'Nigerian NIN verified — name confirmed by ShipMova'
    when b.id_method = 'gh_card' and b.id_name_match in ('match', 'close')
      then 'Ghana Card verified — name matches government record'
    when b.id_method = 'gh_card' then 'Ghana Card verified — name confirmed by ShipMova'
    when b.id_method = 'document' then
      (case b.id_country when 'TG' then 'Togolese ' when 'BJ' then 'Beninese ' else '' end)
      || (case b.id_document_type when 'passport' then 'passport' else 'national ID' end)
      || ' checked by ShipMova'
    else 'ID verified'
  end
  from public.buyer_profiles b
  where b.user_id = p_buyer_id
    and (
      p_buyer_id = auth.uid()
      or public.is_admin()
      or exists (select 1 from public.conversations c where c.buyer_id = p_buyer_id and c.seller_id = auth.uid())
      or exists (
        select 1 from public.purchase_requests pr join public.vehicles v on v.id = pr.vehicle_id
        where pr.buyer_id = p_buyer_id and v.seller_id = auth.uid()
      )
    );
$$;
revoke execute on function public.buyer_id_summary(uuid) from public, anon;
grant execute on function public.buyer_id_summary(uuid) to authenticated;
