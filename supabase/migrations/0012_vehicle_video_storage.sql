-- MOVA — Video upload for seller listings
--
-- Optional, at most one video per listing, alongside (not replacing) photos.
-- Same bucket/table/RLS shape as vehicle-photos (0002): public-read storage
-- bucket with server-side size/format limits, object key
-- "<seller uid>/<uuid>.<ext>" so ownership is the first path segment, and a
-- vehicle_videos row (mirroring vehicle_photos) pointing at the public URL.
--
-- Duration (max 90s) has no server-side equivalent to file_size_limit /
-- allowed_mime_types — Postgres/Storage can't inspect an MP4 container's
-- duration atom without transcoding infra. It's enforced client-side before
-- upload starts; duration_seconds below is the client-reported value, stored
-- as an admin-visible signal during listing review, not as an access control.

-- 1. Storage bucket -----------------------------------------------------------
-- 100 MB per video, mp4 only. Public-read so approved-listing videos render
-- without signed URLs, same as vehicle-photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-videos',
  'vehicle-videos',
  true,
  104857600,
  array['video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. storage.objects policies --------------------------------------------------
-- Object key convention: vehicle-videos/<seller uid>/<uuid>.mp4 — identical
-- ownership-via-path-segment pattern as vehicle-photos.
drop policy if exists "vehicle videos owner insert" on storage.objects;
create policy "vehicle videos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle videos owner update" on storage.objects;
create policy "vehicle videos owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vehicle-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'vehicle-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle videos owner delete" on storage.objects;
create policy "vehicle videos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "vehicle videos owner read" on storage.objects;
create policy "vehicle videos owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vehicle-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- 3. vehicle_videos table -----------------------------------------------------
create table public.vehicle_videos (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  url text not null,
  duration_seconds numeric(6,2),
  created_at timestamptz not null default now()
);

-- At most one video per vehicle — a second insert for the same vehicle_id
-- fails at the database, not just in the UI.
create unique index vehicle_videos_one_per_vehicle
  on public.vehicle_videos (vehicle_id);

alter table public.vehicle_videos enable row level security;

create policy "vehicle videos read" on public.vehicle_videos
  for select using (
    exists (select 1 from public.vehicles v
      where v.id = vehicle_id and (v.status = 'approved' or v.seller_id = auth.uid() or public.is_admin()))
  );

create policy "vehicle videos write by owner" on public.vehicle_videos
  for all using (
    exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.seller_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.vehicles v where v.id = vehicle_id and (v.seller_id = auth.uid() or public.is_admin()))
  );
