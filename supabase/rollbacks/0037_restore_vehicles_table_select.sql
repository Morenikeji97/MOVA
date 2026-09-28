-- Rollback for migration 0037 (vehicles_column_level_select).
--
-- Restores table-level SELECT on public.vehicles for anon and authenticated,
-- which makes every column readable again — including vin,
-- title_photo_path and authorization_document_path, i.e. it re-opens the
-- VIN leak. Use only to get a broken deploy working again.
--
-- Works as long as 0038 (dropping the old computed columns) has NOT been
-- applied: the previous app build selects those functions.
--
-- Not in migrations/ on purpose, so the Supabase CLI never applies it.

grant select on public.vehicles to anon, authenticated;
