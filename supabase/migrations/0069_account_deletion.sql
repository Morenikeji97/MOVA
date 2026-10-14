-- 0069 — account deletion (Privacy Policy §9: "request deletion of your
-- account and associated personal information, subject to ShipMova's
-- retention obligations under Section 8").
--
-- A hard delete would CASCADE away the user's listings and policy-acceptance
-- records (which §8 says are kept) and is blocked by any reservation they
-- made. So deleting an account ANONYMISES it instead:
--   * personal details are cleared (email replaced, phone, WhatsApp, names,
--     ID references, signup IP/device; contact details on their shipments);
--   * their listings are archived (no longer shown);
--   * waitlist rows under their email, favourites and notifications go;
--   * the account is suspended; the app then soft-deletes the login so it
--     can never sign in again;
--   * deal, payment, dispute, review and policy-acceptance records stay,
--     tied to an id that no longer identifies anyone.
-- Refused while the person has a deal in progress.
--
-- New table + one new function; nothing existing is changed or dropped.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  reason text check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'completed', 'refused')),
  requested_at timestamptz not null default now(),
  processed_by uuid references public.users(id),
  processed_at timestamptz,
  note text check (char_length(note) <= 1000)
);
create unique index if not exists account_deletion_one_pending
  on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.account_deletion_requests enable row level security;

-- The person asks for their own account, pending and unprocessed only.
drop policy if exists "deletion request own insert" on public.account_deletion_requests;
create policy "deletion request own insert" on public.account_deletion_requests
  for insert with check (
    user_id = (select auth.uid()) and status = 'pending'
    and processed_by is null and processed_at is null and note is null
  );
drop policy if exists "deletion request own or admin read" on public.account_deletion_requests;
create policy "deletion request own or admin read" on public.account_deletion_requests
  for select using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "deletion request admin update" on public.account_deletion_requests;
create policy "deletion request admin update" on public.account_deletion_requests
  for update using (public.is_admin()) with check (public.is_admin());

grant select, insert on public.account_deletion_requests to authenticated;
grant update (status, processed_by, processed_at, note) on public.account_deletion_requests to authenticated;

-- Anonymise one account. Service role only (the admin's "Delete account"
-- action, after requireAdmin with the authenticator code). Raises
-- 'account_has_open_deals' and changes nothing if a deal is in progress.
create or replace function public.anonymize_account(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_listings int;
  v_shipments int;
  v_waitlist int;
begin
  select email into v_email from public.users where id = p_user for update;
  if v_email is null then
    raise exception 'account_not_found';
  end if;

  if exists (select 1 from public.purchase_requests where buyer_id = p_user and status in ('submitted', 'under_review', 'verified'))
     or exists (select 1 from public.purchase_requests pr join public.vehicles v on v.id = pr.vehicle_id
                where v.seller_id = p_user and pr.status in ('submitted', 'under_review', 'verified'))
     or exists (select 1 from public.shipment_requests where buyer_id = p_user and status = 'pending')
     or exists (select 1 from public.shipment_requests s join public.shippers sh on sh.id = s.shipper_id
                where sh.user_id = p_user and s.status = 'pending')
     or exists (select 1 from public.inspections x join public.inspectors i on i.id = x.inspector_id
                where i.user_id = p_user and x.status in ('assigned', 'submitted'))
     or exists (select 1 from public.disputes where reporter_id = p_user and status in ('open', 'approved_pending_refund'))
  then
    raise exception 'account_has_open_deals';
  end if;

  update public.vehicles set status = 'archived'
    where seller_id = p_user and status in ('draft', 'pending_review', 'approved', 'rejected');
  get diagnostics v_listings = row_count;

  update public.shipment_requests
    set buyer_name = null, buyer_email = null, buyer_phone = null, buyer_whatsapp = null
    where buyer_id = p_user;
  get diagnostics v_shipments = row_count;

  delete from public.waitlist_signups where lower(email) = lower(v_email);
  get diagnostics v_waitlist = row_count;

  delete from public.favorites where buyer_id = p_user;
  delete from public.notifications where user_id = p_user;

  update public.buyer_profiles
    set full_name = null, city = null, nin_verification_ref = null, bvn_verification_ref = null,
        id_legal_name = null, id_record_name = null, id_document_path = null, id_review_note = null
    where user_id = p_user;
  update public.seller_profiles
    set full_name = null, id_document_url = null, id_verification_provider_ref = null
    where user_id = p_user;
  update public.inspectors
    set full_name = 'Deleted account', phone = null, status = 'suspended'
    where user_id = p_user;
  -- A shipper company is a business record: it stays, unlinked from the login.
  update public.shippers set user_id = null where user_id = p_user;

  update public.users
    set email = 'deleted+' || p_user::text || '@deleted.shipmova.invalid',
        phone = null, whatsapp_number = null, signup_ip = null, signup_device_fingerprint = null,
        status = 'suspended'
    where id = p_user;

  return jsonb_build_object('listings_archived', v_listings, 'shipments_scrubbed', v_shipments, 'waitlist_deleted', v_waitlist);
end;
$$;
revoke execute on function public.anonymize_account(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_account(uuid) to service_role;
