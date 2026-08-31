-- MOVA Phase 1 — Vehicle photo storage bucket + Row-Level Security
-- Depends on 0001_init.sql (public.vehicles, public.vehicle_photos).

-- 1. Storage bucket ---------------------------------------------------------
-- Public-read so approved-listing photos render without signed URLs. Writes and
-- deletes are locked to the owning seller by the storage.objects policies below.
-- 10 MiB per image, common web formats only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-photos',
  'vehicle-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. storage.objects policies --------------------------------------------------
-- Object key convention: vehicle-photos/<seller uid>/<uuid>.<ext>
-- (storage.foldername(name))[1] is that first "<seller uid>" path segment, so a
-- seller can only touch objects inside their own folder. Reads stay public via
-- the bucket flag above; the select policy here only covers authenticated
-- listing of one's own uploads.
drop policy if exists "vehicle photos owner insert" on storage.objects;
create policy "vehicle photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle photos owner update" on storage.objects;
create policy "vehicle photos owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle photos owner delete" on storage.objects;
create policy "vehicle photos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle photos owner read" on storage.objects;
create policy "vehicle photos owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- 3. vehicle_photos integrity ------------------------------------------------
-- At most one primary photo per vehicle.
create unique index if not exists vehicle_photos_one_primary_per_vehicle
  on public.vehicle_photos (vehicle_id)
  where is_primary;

-- Fetch a vehicle's gallery in display order.
create index if not exists vehicle_photos_vehicle_id_sort_idx
  on public.vehicle_photos (vehicle_id, sort_order);
