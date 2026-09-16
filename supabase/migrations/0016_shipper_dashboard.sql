-- MOVA — Shipper dashboard (/shipper/dashboard, /shipper/profile)
--
-- Adds what a shipper needs to manage their own assigned shipments and
-- profile day-to-day, without touching anything billing- or
-- approval-related (those stay admin/webhook-owned).
--
-- 1. LINKAGE GAP: shipment_requests had no link to the vehicle sale it's
--    for — only (shipper_id, buyer_id). A buyer who bought two vehicles and
--    picked the same shipper for both would collide into one row (the old
--    app-level "one shipment request per buyer + shipper" dedupe in
--    selectShippingRate never accounted for the vehicle). Adds
--    purchase_request_id and a real uniqueness constraint on
--    (purchase_request_id, shipper_id).
--
-- 2. STATUS SPLIT: shipment_requests.status ('pending'/'completed') is
--    billing-owned — the admin "mark shipment completed" action flips it to
--    trigger the Stripe commission charge, and the reviews system (0006)
--    gates buyer->shipper review eligibility on status = 'completed'.
--    Shippers must NOT be able to set this themselves. A new
--    shipping_status column (awaiting_pickup -> picked_up -> in_transit ->
--    delivered) is the shipper-owned logistics status; it never touches
--    billing or review eligibility. Free movement between the four values
--    is allowed (no forward-only enforcement) — this is a low-stakes
--    logistics label with no financial/security consequence, and a
--    non-technical shipper mis-tapping the wrong one should be able to
--    correct it without contacting support.
--
-- 3. BUYER CONTACT REVEAL: mirrors the existing precedent exactly — the
--    shipper's own contact is already snapshotted onto shipment_requests and
--    revealed to the buyer unconditionally at row-insert time
--    (shipper_details_revealed_at in selectShippingRate), not gated on the
--    MOVA fee being paid. The new buyer_* columns do the same in reverse.
--
-- 4. RLS SHAPE for the two owner-write surfaces this adds (shippers editing
--    their own profile; shippers updating shipping_status) follows the
--    0009/0010/0011 pattern: USING/WITH CHECK only gates *which row*, not
--    *which columns* change, so each gets a broad owner-row UPDATE policy
--    plus a BEFORE UPDATE trigger that reverts every other column to its old
--    value for any non-admin/non-service-role actor.
--
-- 5. shipment_proof_photos / shipment_updates are new, permanent-record
--    tables (no update/delete policy for anyone) — same shape as
--    dispute-evidence (0015): shipper (owner) inserts, shipper + buyer +
--    admin read.

-- 1. Link shipment_requests to its purchase_request ---------------------------
alter table public.shipment_requests
  add column purchase_request_id uuid references public.purchase_requests(id);

-- Backfill: this project's one existing row ties to its buyer's one paid
-- purchase_request.
update public.shipment_requests sr
set purchase_request_id = (
  select pr.id from public.purchase_requests pr
  where pr.buyer_id = sr.buyer_id
  order by (pr.mova_fee_payment_status = 'paid') desc, pr.created_at asc
  limit 1
)
where sr.purchase_request_id is null;

alter table public.shipment_requests
  alter column purchase_request_id set not null;

create unique index shipment_requests_purchase_request_shipper_idx
  on public.shipment_requests (purchase_request_id, shipper_id);

-- 2. Shipper-owned logistics status, separate from billing status -------------
create type shipment_shipping_status as enum (
  'awaiting_pickup', 'picked_up', 'in_transit', 'delivered'
);

alter table public.shipment_requests
  add column shipping_status shipment_shipping_status not null default 'awaiting_pickup',
  add column shipping_status_updated_at timestamptz;

-- 3. Buyer contact snapshot, revealed to the shipper (mirrors shipper_*) ------
alter table public.shipment_requests
  add column buyer_details_revealed_at timestamptz,
  add column buyer_name text,
  add column buyer_email text,
  add column buyer_phone text,
  add column buyer_whatsapp text;

update public.shipment_requests sr
set
  buyer_details_revealed_at = coalesce(sr.buyer_details_revealed_at, sr.created_at),
  buyer_name = bp.full_name,
  buyer_email = u.email,
  buyer_phone = u.phone,
  buyer_whatsapp = u.whatsapp_number
from public.users u
left join public.buyer_profiles bp on bp.user_id = u.id
where u.id = sr.buyer_id
  and sr.buyer_details_revealed_at is null;

-- 4a. shipment_requests: shipper may update shipping_status only -------------
create or replace function public.shipment_requests_guard_shipping_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if not exists (
    select 1 from public.shippers s
    where s.id = old.shipper_id and s.user_id = auth.uid()
  ) then
    -- Not the owning shipper (RLS below shouldn't allow reaching here, but
    -- don't trust that alone) — revert everything.
    return old;
  end if;

  new.shipping_status_updated_at :=
    case when new.shipping_status is distinct from old.shipping_status
         then now()
         else old.shipping_status_updated_at
    end;

  new.shipper_id := old.shipper_id;
  new.shipping_rate_id := old.shipping_rate_id;
  new.buyer_id := old.buyer_id;
  new.purchase_request_id := old.purchase_request_id;
  new.agreed_rate := old.agreed_rate;
  new.currency := old.currency;
  new.commission_pct := old.commission_pct;
  new.commission_owed := old.commission_owed;
  new.commission_charge_status := old.commission_charge_status;
  new.stripe_charge_id := old.stripe_charge_id;
  new.status := old.status;
  new.shipper_details_revealed_at := old.shipper_details_revealed_at;
  new.shipper_company_name := old.shipper_company_name;
  new.shipper_contact_name := old.shipper_contact_name;
  new.shipper_contact_email := old.shipper_contact_email;
  new.shipper_contact_phone := old.shipper_contact_phone;
  new.buyer_details_revealed_at := old.buyer_details_revealed_at;
  new.buyer_name := old.buyer_name;
  new.buyer_email := old.buyer_email;
  new.buyer_phone := old.buyer_phone;
  new.buyer_whatsapp := old.buyer_whatsapp;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger shipment_requests_guard_shipping_status
  before update on public.shipment_requests
  for each row execute procedure public.shipment_requests_guard_shipping_status();

revoke execute on function public.shipment_requests_guard_shipping_status()
  from public, anon, authenticated;

create policy "shipment requests shipper update shipping status" on public.shipment_requests
  for update
  using (
    exists (select 1 from public.shippers s where s.id = shipper_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.shippers s where s.id = shipper_id and s.user_id = auth.uid())
  );

-- 4b. shippers: owner may edit company_name / service_countries / description
alter table public.shippers
  add column description text;

revoke select on public.shippers from anon, authenticated;
grant select (
  id, user_id, company_name, contact_name, contact_email, contact_phone,
  fmc_oti_license_number, service_countries, status, payment_status,
  terms_accepted_at, card_on_file, reviewed_by, rejection_reason,
  reinstated_at, description, created_at
) on public.shippers to anon, authenticated;

create or replace function public.shippers_guard_owner_editable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if not (old.user_id is not null and old.user_id = auth.uid()) then
    return old;
  end if;

  -- Editable by the owning shipper: company_name, service_countries,
  -- description. Everything else reverts.
  new.id := old.id;
  new.user_id := old.user_id;
  new.contact_name := old.contact_name;
  new.contact_email := old.contact_email;
  new.contact_phone := old.contact_phone;
  new.fmc_oti_license_number := old.fmc_oti_license_number;
  new.status := old.status;
  new.payment_status := old.payment_status;
  new.terms_accepted_at := old.terms_accepted_at;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_payment_method_id := old.stripe_payment_method_id;
  new.card_on_file := old.card_on_file;
  new.reviewed_by := old.reviewed_by;
  new.rejection_reason := old.rejection_reason;
  new.reinstated_at := old.reinstated_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger shippers_guard_owner_editable_fields
  before update on public.shippers
  for each row execute procedure public.shippers_guard_owner_editable_fields();

revoke execute on function public.shippers_guard_owner_editable_fields()
  from public, anon, authenticated;

create policy "shippers owner update" on public.shippers
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 5. Proof-of-pickup / proof-of-delivery photos --------------------------------
create type shipment_proof_kind as enum ('pickup', 'delivery');

create table public.shipment_proof_photos (
  id uuid primary key default uuid_generate_v4(),
  shipment_request_id uuid not null references public.shipment_requests(id) on delete cascade,
  kind shipment_proof_kind not null,
  storage_path text not null,
  uploaded_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index shipment_proof_photos_shipment_idx
  on public.shipment_proof_photos (shipment_request_id);

alter table public.shipment_proof_photos enable row level security;

create policy "shipment proof photos read" on public.shipment_proof_photos
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shipment_requests sr
      where sr.id = shipment_request_id
        and (
          sr.buyer_id = auth.uid()
          or exists (select 1 from public.shippers s where s.id = sr.shipper_id and s.user_id = auth.uid())
        )
    )
  );

create policy "shipment proof photos shipper insert" on public.shipment_proof_photos
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.shipment_requests sr
      join public.shippers s on s.id = sr.shipper_id
      where sr.id = shipment_request_id and s.user_id = auth.uid()
    )
  );

-- Storage bucket. Object key convention:
-- shipment-proof-photos/<shipper uid>/<uuid>.<ext> — folder-scoped insert
-- exactly like vehicle-photos/dispute-evidence. Read also needs to reach the
-- buyer (whose uid won't match the shipper's folder), so that branch joins
-- through shipment_proof_photos.storage_path -> shipment_requests.buyer_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shipment-proof-photos',
  'shipment-proof-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shipment proof photos owner insert" on storage.objects;
create policy "shipment proof photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shipment-proof-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "shipment proof photos read" on storage.objects;
create policy "shipment proof photos read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shipment-proof-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or public.is_admin()
      or exists (
        select 1 from public.shipment_proof_photos spp
        join public.shipment_requests sr on sr.id = spp.shipment_request_id
        where spp.storage_path = name and sr.buyer_id = auth.uid()
      )
    )
  );

-- No update/delete policy for anyone — proof is permanent once submitted,
-- same as dispute-evidence and bank-transfer-proofs.

-- 6. Buyer-visible shipment notes ---------------------------------------------
create table public.shipment_updates (
  id uuid primary key default uuid_generate_v4(),
  shipment_request_id uuid not null references public.shipment_requests(id) on delete cascade,
  author_id uuid not null references public.users(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index shipment_updates_shipment_idx
  on public.shipment_updates (shipment_request_id, created_at);

alter table public.shipment_updates enable row level security;

create policy "shipment updates read" on public.shipment_updates
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shipment_requests sr
      where sr.id = shipment_request_id
        and (
          sr.buyer_id = auth.uid()
          or exists (select 1 from public.shippers s where s.id = sr.shipper_id and s.user_id = auth.uid())
        )
    )
  );

create policy "shipment updates shipper insert" on public.shipment_updates
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.shipment_requests sr
      join public.shippers s on s.id = sr.shipper_id
      where sr.id = shipment_request_id and s.user_id = auth.uid()
    )
  );

-- No update/delete policy for anyone — same permanent-record shape.
