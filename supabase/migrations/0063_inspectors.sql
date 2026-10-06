-- 0063 — inspectors and in-person inspections at pickup (Day 4).
--
-- An inspector is an ordinary ShipMova login (like shippers, there's no
-- separate role) with an approved inspectors row. For each reservation an
-- admin asks ShipMova to pick an inspector at random among those who serve
-- the car's state and pass the anti-collusion checks against the seller
-- (lib/inspector-assignment.ts). The inspector uploads geotagged photos of
-- the VIN plate, odometer and title and records what they read; an admin
-- passes or fails it. A completed inspection records the inspector's pay:
-- 2% of the car price (paid outside ShipMova; marked paid by an admin).
-- A pass shows "Inspected at pickup ✓" to the buyer and seller.
--
-- Everything here is new; nothing existing is changed. All writes go
-- through ShipMova's server (service role) or an admin, except an
-- inspector's own application and photo uploads into their own folder.

create table if not exists public.inspectors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 200),
  phone text check (char_length(phone) <= 40),
  service_states text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'rejected')),
  rejection_reason text check (char_length(rejection_reason) <= 1000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.inspectors enable row level security;
drop policy if exists "inspectors owner or admin read" on public.inspectors;
create policy "inspectors owner or admin read" on public.inspectors
  for select using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists "inspectors apply" on public.inspectors;
create policy "inspectors apply" on public.inspectors
  for insert with check (user_id = (select auth.uid()) and status = 'pending');
drop policy if exists "inspectors admin update" on public.inspectors;
create policy "inspectors admin update" on public.inspectors
  for update using (public.is_admin()) with check (public.is_admin());

-- An application starts pending and unreviewed, whatever the browser sends.
create or replace function public.inspectors_guard_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  new.status := 'pending';
  new.rejection_reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.is_test := false;
  return new;
end;
$$;
drop trigger if exists inspectors_guard_insert on public.inspectors;
create trigger inspectors_guard_insert
  before insert on public.inspectors
  for each row execute function public.inspectors_guard_insert();

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  inspector_id uuid not null references public.inspectors(id),
  status text not null default 'assigned' check (status in ('assigned', 'submitted', 'passed', 'failed', 'cancelled')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  -- How many inspectors were eligible, and counts of why others weren't
  -- (no names or personal data): {"eligible": 3, "excluded": {"same_phone": 1}}
  assignment_note jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  vin_read text check (char_length(vin_read) <= 17),
  odometer_reading integer check (odometer_reading >= 0),
  title_matches boolean,
  condition_notes text check (char_length(condition_notes) <= 2000),
  -- Checks on the photos' locations and times (lib/inspection-checks.ts).
  photo_check_flags text[] not null default '{}',
  decided_at timestamptz,
  decided_by uuid,
  decision_note text check (char_length(decision_note) <= 1000),
  pay_pct numeric(5, 2) not null default 2.00,
  pay_usd numeric(12, 2),
  pay_status text not null default 'none' check (pay_status in ('none', 'owed', 'paid')),
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz not null default now()
);
-- At most one inspection in progress or passed per deal.
create unique index if not exists inspections_one_open_per_deal
  on public.inspections (purchase_request_id)
  where status in ('assigned', 'submitted', 'passed');
alter table public.inspections enable row level security;
drop policy if exists "inspections inspector or admin read" on public.inspections;
create policy "inspections inspector or admin read" on public.inspections
  for select using (
    public.is_admin()
    or exists (select 1 from public.inspectors i where i.id = inspections.inspector_id and i.user_id = (select auth.uid()))
  );

drop policy if exists "inspections admin update" on public.inspections;
create policy "inspections admin update" on public.inspections
  for update using (public.is_admin()) with check (public.is_admin());
grant update on public.inspections to authenticated;

create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  kind text not null check (kind in ('vin', 'odometer', 'title', 'car')),
  storage_path text not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  accuracy_m real check (accuracy_m >= 0),
  captured_at timestamptz,
  uploaded_at timestamptz not null default now()
);
alter table public.inspection_photos enable row level security;
drop policy if exists "inspection photos inspector or admin read" on public.inspection_photos;
create policy "inspection photos inspector or admin read" on public.inspection_photos
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.inspections x join public.inspectors i on i.id = x.inspector_id
      where x.id = inspection_photos.inspection_id and i.user_id = (select auth.uid())
    )
  );

grant select, insert on public.inspectors to authenticated;
grant update on public.inspectors to authenticated;
grant select on public.inspections, public.inspection_photos to authenticated;

-- Private bucket for inspection photos: the inspector uploads into their own
-- folder; nobody reads through the API (admins get short-lived links).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "inspection photos owner insert" on storage.objects;
create policy "inspection photos owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "inspection photos owner delete" on storage.objects;
create policy "inspection photos owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- What the buyer and seller see: the badge, never the inspector or the pay.
create or replace function public.inspection_summary(p_purchase_request_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case x.status
    when 'passed' then 'Inspected at pickup ✓ — VIN, odometer and title checked in person'
    when 'failed' then 'Inspection at pickup failed — ShipMova will contact you'
    when 'submitted' then 'Inspection done — ShipMova is reviewing the report'
    when 'assigned' then 'Inspector assigned for pickup'
  end
  from public.inspections x
  join public.purchase_requests pr on pr.id = x.purchase_request_id
  join public.vehicles v on v.id = pr.vehicle_id
  where x.purchase_request_id = p_purchase_request_id
    and x.status <> 'cancelled'
    and (pr.buyer_id = auth.uid() or v.seller_id = auth.uid() or public.is_admin())
  order by x.created_at desc
  limit 1;
$$;
revoke execute on function public.inspection_summary(uuid) from public, anon;
grant execute on function public.inspection_summary(uuid) to authenticated;
