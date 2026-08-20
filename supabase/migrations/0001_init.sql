-- MOVA Phase 0 — Initial schema + Row-Level Security
create extension if not exists "uuid-ossp";

create type user_role as enum ('seller', 'buyer', 'admin');
create type user_status as enum ('active', 'suspended');
create type verification_status as enum ('unverified', 'pending', 'verified', 'failed');
create type vin_decode_status as enum ('pending', 'matched', 'mismatch');
create type title_history_status as enum ('not_run', 'pending', 'clean', 'branded');
create type vehicle_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'sold', 'archived');
create type shipping_method as enum ('roro', 'container');
create type shipper_app_status as enum ('submitted', 'under_review', 'approved', 'rejected');
create type purchase_request_status as enum ('submitted', 'under_review', 'verified', 'rejected', 'completed', 'cancelled');
create type doc_visibility as enum ('admin_only', 'public');
create type doc_type as enum ('title', 'registration', 'inspection', 'other');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text,
  whatsapp_number text,
  role user_role not null,
  status user_status not null default 'active',
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.seller_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  full_name text,
  country text default 'US',
  id_document_url text,
  id_verification_provider_ref text,
  id_verification_status verification_status not null default 'unverified',
  id_verified_at timestamptz,
  verification_status verification_status not null default 'unverified',
  created_at timestamptz not null default now()
);

create table public.buyer_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  full_name text,
  country text default 'NG',
  city text,
  nin_verification_status verification_status not null default 'unverified',
  nin_verification_ref text,
  bvn_verification_status verification_status not null default 'unverified',
  bvn_verification_ref text,
  verification_status verification_status not null default 'unverified',
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references public.users(id) on delete cascade,
  vin text not null,
  vin_decode_status vin_decode_status not null default 'pending',
  year int not null,
  make text not null,
  model text not null,
  trim text,
  mileage int not null,
  exterior_color text,
  interior_color text,
  transmission text,
  fuel_type text,
  condition text,
  accident_history text,
  title_status text,
  title_history_check_status title_history_status not null default 'not_run',
  location_city text not null,
  location_state text not null,
  price_usd numeric(12,2) not null,
  description text,
  status vehicle_status not null default 'draft',
  verification_status verification_status not null default 'unverified',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_photos (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  is_primary boolean not null default false
);

create table public.vehicle_documents (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  type doc_type not null,
  url text not null,
  visibility doc_visibility not null default 'admin_only',
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.favorites (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, vehicle_id)
);

create table public.shipping_company_applications (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  business_registration_number text,
  fmc_oti_license_number text,
  bond_proof_url text,
  insurance_proof_url text,
  methods_offered text,
  status shipper_app_status not null default 'submitted',
  reviewed_by uuid references public.users(id),
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table public.shipping_companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  contact_email text,
  contact_phone text,
  fmc_oti_license_number text,
  active boolean not null default true,
  source_application_id uuid references public.shipping_company_applications(id),
  created_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default uuid_generate_v4(),
  shipping_company_id uuid not null references public.shipping_companies(id) on delete cascade,
  method shipping_method not null,
  destination_country text not null default 'NG',
  estimated_cost_usd numeric(10,2) not null,
  estimated_time_weeks_min int not null,
  estimated_time_weeks_max int not null,
  active boolean not null default true
);

create table public.purchase_requests (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id),
  buyer_id uuid not null references public.users(id),
  shipping_rate_id uuid references public.shipping_rates(id),
  status purchase_request_status not null default 'submitted',
  mova_fee_usd numeric(10,2),
  payment_method text,
  payment_reference text,
  notes text,
  assigned_admin_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transaction_status_history (
  id uuid primary key default uuid_generate_v4(),
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  status purchase_request_status not null,
  changed_by uuid references public.users(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.inquiries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id),
  name text,
  email text,
  subject text,
  message text not null,
  channel text default 'web',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.admin_actions_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null references public.users(id),
  action_type text not null,
  target_table text not null,
  target_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.users enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.buyer_profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_photos enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.favorites enable row level security;
alter table public.shipping_company_applications enable row level security;
alter table public.shipping_companies enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.transaction_status_history enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin_actions_log enable row level security;
alter table public.notifications enable row level security;

create policy "users read own" on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy "users update own" on public.users
  for update using (id = auth.uid() or public.is_admin());
create policy "admins insert users" on public.users
  for insert with check (public.is_admin() or id = auth.uid());

create policy "seller profile owner read" on public.seller_profiles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "seller profile owner write" on public.seller_profiles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "buyer profile owner read" on public.buyer_profiles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "buyer profile owner write" on public.buyer_profiles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "vehicles public read approved" on public.vehicles
  for select using (status = 'approved' or seller_id = auth.uid() or public.is_admin());
create policy "vehicles seller insert" on public.vehicles
  for insert with check (seller_id = auth.uid());
create policy "vehicles seller update own" on public.vehicles
  for update using (seller_id = auth.uid() or public.is_admin());
create policy "vehicles seller delete own draft" on public.vehicles
  for delete using ((seller_id = auth.uid() and status = 'draft') or public.is_admin());

create policy "vehicle photos read" on public.vehicle_photos
  for select using (
    exists (select 1 from public.vehicles v
      where v.id = vehicle_id and (v.status = 'approved' or v.seller_id = auth.uid() or public.is_admin()))
  );
create policy "vehicle photos write by owner" on public.vehicle_photos
  for all using (
    exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.seller_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.seller_id = auth.uid() or public.is_admin()))
  );

create policy "vehicle documents read" on public.vehicle_documents
  for select using (
    visibility = 'public'
    or exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.seller_id = auth.uid() or public.is_admin()))
  );
create policy "vehicle documents write by owner" on public.vehicle_documents
  for insert with check (
    exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.seller_id = auth.uid() or public.is_admin()))
  );

create policy "favorites owner all" on public.favorites
  for all using (buyer_id = auth.uid() or public.is_admin())
  with check (buyer_id = auth.uid() or public.is_admin());

create policy "shipper applications insert" on public.shipping_company_applications
  for insert with check (true);
create policy "shipper applications admin read" on public.shipping_company_applications
  for select using (public.is_admin());
create policy "shipper applications admin update" on public.shipping_company_applications
  for update using (public.is_admin());

create policy "shipping companies public read" on public.shipping_companies
  for select using (active = true or public.is_admin());
create policy "shipping companies admin write" on public.shipping_companies
  for all using (public.is_admin()) with check (public.is_admin());

create policy "shipping rates public read" on public.shipping_rates
  for select using (active = true or public.is_admin());
create policy "shipping rates admin write" on public.shipping_rates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "purchase requests read" on public.purchase_requests
  for select using (
    buyer_id = auth.uid()
    or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.seller_id = auth.uid())
    or public.is_admin()
  );
create policy "purchase requests buyer insert" on public.purchase_requests
  for insert with check (buyer_id = auth.uid());
create policy "purchase requests admin update" on public.purchase_requests
  for update using (public.is_admin());

create policy "transaction history read" on public.transaction_status_history
  for select using (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_id
      and (pr.buyer_id = auth.uid()
           or exists (select 1 from public.vehicles v where v.id = pr.vehicle_id and v.seller_id = auth.uid())
           or public.is_admin())
    )
  );
create policy "transaction history admin insert" on public.transaction_status_history
  for insert with check (public.is_admin());

create policy "inquiries insert" on public.inquiries
  for insert with check (true);
create policy "inquiries admin read" on public.inquiries
  for select using (public.is_admin() or user_id = auth.uid());

create policy "admin log admin read" on public.admin_actions_log
  for select using (public.is_admin());
create policy "admin log admin insert" on public.admin_actions_log
  for insert with check (public.is_admin());

create policy "notifications owner read" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy "notifications owner update read state" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications admin insert" on public.notifications
  for insert with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role, status)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer'),
    'active'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
