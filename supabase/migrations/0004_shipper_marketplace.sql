-- MOVA Phase 3 — Shipper signup + rate marketplace + automated commission
--
-- Adds the shipper side of the platform: shippers apply, an admin approves,
-- shippers list flat-rate shipping prices (shown to buyers as-is, never marked
-- up), buyers pick a shipper at reservation time, and MOVA charges the shipper
-- an 8% commission off-session when the admin marks a shipment completed.
--
-- Entirely separate from the buyer vehicle-sale flow (purchase_requests) and
-- its Stripe Checkout / webhook. Sellers are untouched.

-- 1. Drop the unused Phase-0 shipping scaffold -------------------------------
-- shipping_company_applications / shipping_companies / shipping_rates were
-- created in 0001_init.sql, hold zero rows, and are referenced by no app code.
-- The spec's `shipping_rates` has a different shape, so we recreate it below.
-- CASCADE also drops the vestigial FK on purchase_requests.shipping_rate_id;
-- that column stays (bare uuid) so existing types/queries are unaffected.
drop table if exists public.shipping_rates cascade;
drop table if exists public.shipping_companies cascade;
drop table if exists public.shipping_company_applications cascade;

-- 2. Enums ------------------------------------------------------------------
create type shipper_status as enum ('pending', 'approved', 'rejected');
create type shipper_payment_status as enum ('good_standing', 'past_due', 'suspended');
create type commission_charge_status as enum ('pending', 'charged', 'failed');
create type shipment_request_status as enum ('pending', 'completed');

-- 3. Tables --------------------------------------------------------------------
create table public.shippers (
  id uuid primary key default uuid_generate_v4(),
  -- Optional link to an auth user so an approved shipper can sign in and manage
  -- their own rates under RLS. Signup itself works for logged-out visitors.
  user_id uuid unique references public.users(id) on delete set null,
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  fmc_oti_license_number text not null,
  -- ISO-3166 alpha-2 codes: NG, GH, TG, BJ (see lib/shipping.ts).
  service_countries text[] not null default '{}',
  status shipper_status not null default 'pending',
  payment_status shipper_payment_status not null default 'good_standing',
  terms_accepted_at timestamptz,
  -- Stripe Customer + saved PaymentMethod for off-session commission charges.
  -- Opaque Stripe tokens — no raw card data. Column-level grants below keep
  -- these two readable only by the service role.
  stripe_customer_id text,
  stripe_payment_method_id text,
  -- Mirror of "stripe_payment_method_id is set" for admin display without
  -- touching the token column. Written by the shipper-commission webhook.
  card_on_file boolean not null default false,
  reviewed_by uuid references public.users(id),
  rejection_reason text,
  -- Set when an admin lifts a suspension; failed commissions before this
  -- instant no longer count toward re-suspension (see lib/shipping.ts).
  reinstated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default uuid_generate_v4(),
  shipper_id uuid not null references public.shippers(id) on delete cascade,
  origin_region text not null,
  origin_port text,
  destination_country text not null,
  vehicle_size_type text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shipment_requests (
  id uuid primary key default uuid_generate_v4(),
  shipper_id uuid not null references public.shippers(id) on delete cascade,
  shipping_rate_id uuid references public.shipping_rates(id) on delete set null,
  buyer_id uuid not null references public.users(id) on delete cascade,
  agreed_rate numeric(12,2) not null,
  currency text not null default 'USD',
  commission_pct numeric(5,2) not null default 8,
  commission_owed numeric(12,2) not null default 0,
  commission_charge_status commission_charge_status not null default 'pending',
  stripe_charge_id text,
  status shipment_request_status not null default 'pending',
  -- Shipper contact snapshot, revealed to the buyer on selection. Snapshotted
  -- (not joined) because RLS keeps a buyer from reading the shippers contact
  -- columns — the same pattern purchase_requests uses for seller contact.
  shipper_details_revealed_at timestamptz,
  shipper_company_name text,
  shipper_contact_name text,
  shipper_contact_email text,
  shipper_contact_phone text,
  created_at timestamptz not null default now()
);

create index shipping_rates_destination_idx
  on public.shipping_rates (destination_country) where active;
create index shipping_rates_shipper_idx on public.shipping_rates (shipper_id);
create index shipment_requests_shipper_idx on public.shipment_requests (shipper_id);
create index shipment_requests_buyer_idx on public.shipment_requests (buyer_id);

-- 4. Column-level grants on shippers --------------------------------------
-- anon / authenticated may read every column EXCEPT the two opaque Stripe
-- token columns, which are readable only via the service role (the commission
-- webhook + completeShipment). A crafted PostgREST query for them is rejected
-- outright, so raw payment-method references never leave Stripe's tokens.
revoke select on public.shippers from anon, authenticated;
grant select (
  id, user_id, company_name, contact_name, contact_email, contact_phone,
  fmc_oti_license_number, service_countries, status, payment_status,
  terms_accepted_at, card_on_file, reviewed_by, rejection_reason,
  reinstated_at, created_at
) on public.shippers to anon, authenticated;

-- 5. Buyer-facing rate list ----------------------------------------------
-- Approved, non-suspended shippers' active rates, projecting company name +
-- price + standing so the app can sort good-standing first then cheapest.
-- security_invoker => base-table RLS + the column grants above both apply,
-- so it can expose nothing the querying user couldn't already read directly.
create view public.shipper_rates_public
with (security_invoker = true) as
select
  r.id as rate_id,
  r.shipper_id,
  s.company_name,
  r.origin_region,
  r.origin_port,
  r.destination_country,
  r.vehicle_size_type,
  r.price,
  r.currency,
  s.payment_status
from public.shipping_rates r
join public.shippers s on s.id = r.shipper_id
where r.active
  and s.status = 'approved'
  and s.payment_status <> 'suspended';

grant select on public.shipper_rates_public to anon, authenticated;

-- 6. Row-Level Security -----------------------------------------------------
alter table public.shippers enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.shipment_requests enable row level security;

-- shippers: public signup insert (can't self-approve); owner + admin read;
-- anyone may read an approved, non-suspended shipper row (minus the Stripe
-- token columns, which the grant above withholds); admin-only mutation. The
-- shipper-commission webhook uses the service role.
create policy "shippers signup insert" on public.shippers
  for insert with check (
    status = 'pending'
    and payment_status = 'good_standing'
    and (user_id is null or user_id = auth.uid())
  );
create policy "shippers owner or admin read" on public.shippers
  for select using (
    public.is_admin() or (user_id is not null and user_id = auth.uid())
  );
create policy "shippers approved public read" on public.shippers
  for select using (status = 'approved' and payment_status <> 'suspended');
create policy "shippers admin update" on public.shippers
  for update using (public.is_admin()) with check (public.is_admin());

-- shipping_rates: the owning (approved) shipper manages their own; admin full
-- access; anyone may read an active rate whose shipper is approved and not
-- suspended (this table has no sensitive columns).
create policy "shipping rates owner or admin read" on public.shipping_rates
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shippers s
      where s.id = shipper_id and s.user_id = auth.uid()
    )
  );
create policy "shipping rates public active read" on public.shipping_rates
  for select using (
    active and exists (
      select 1 from public.shippers s
      where s.id = shipper_id
        and s.status = 'approved'
        and s.payment_status <> 'suspended'
    )
  );
create policy "shipping rates admin write" on public.shipping_rates
  for all using (public.is_admin()) with check (public.is_admin());
create policy "shipping rates shipper write" on public.shipping_rates
  for all using (
    exists (
      select 1 from public.shippers s
      where s.id = shipper_id and s.user_id = auth.uid() and s.status = 'approved'
    )
  ) with check (
    exists (
      select 1 from public.shippers s
      where s.id = shipper_id and s.user_id = auth.uid() and s.status = 'approved'
    )
  );

-- shipment_requests: buyer sees own, owning shipper sees own, admin sees all.
-- Buyers insert their own; only admin updates (commission fields are written
-- by the shipper-commission webhook via the service role).
create policy "shipment requests read" on public.shipment_requests
  for select using (
    buyer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.shippers s
      where s.id = shipper_id and s.user_id = auth.uid()
    )
  );
create policy "shipment requests buyer insert" on public.shipment_requests
  for insert with check (
    buyer_id = auth.uid()
    and status = 'pending'
    and commission_charge_status = 'pending'
  );
create policy "shipment requests admin update" on public.shipment_requests
  for update using (public.is_admin()) with check (public.is_admin());
