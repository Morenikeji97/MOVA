-- Rollback for 0063_inspectors.sql (database owner, one transaction).
-- Everything 0063 created was new. Dropping the tables deletes any
-- inspector applications, inspections and photo records made after 0063 —
-- export first if any real inspection exists. Empty the inspection-photos
-- bucket through the Storage API before the bucket delete.
begin;
drop function if exists public.inspection_summary(uuid);
drop policy if exists "inspection photos owner insert" on storage.objects;
drop policy if exists "inspection photos owner delete" on storage.objects;
delete from storage.buckets where id = 'inspection-photos';
drop table if exists public.inspection_photos;
drop table if exists public.inspections;
drop trigger if exists inspectors_guard_insert on public.inspectors;
drop function if exists public.inspectors_guard_insert();
drop table if exists public.inspectors;
commit;
