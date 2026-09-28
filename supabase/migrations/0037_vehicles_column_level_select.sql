-- MOVA — second half of 0036: make vin, title_photo_path and
-- authorization_document_path unreadable with the anon key.
--
-- Revokes the table-level SELECT that made 0007's column-level
-- `revoke select (vin)` a no-op, and grants SELECT back on every other
-- column (the pattern shippers already uses). See 0036 for why the
-- computed columns had to be replaced first: PostgREST calls them with a
-- whole-row reference, which needs SELECT on every column.
--
-- Breaks any app build that still selects vehicle_vin_display or the other
-- computed columns (they're whole-row calls, refused under column grants).
-- The functions themselves are left in place so the rollback — re-granting
-- table-level SELECT, supabase/rollbacks/0037_restore_vehicles_table_select.sql
-- — fully restores the previous build. They're dropped in 0038, once the
-- code that stops using them is deployed and verified.
--
-- NOTE for future migrations: a column added to vehicles after this one is
-- NOT readable by anon/authenticated until it is granted explicitly.

-- 1. Column-level SELECT ---------------------------------------------------
revoke select on public.vehicles from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'vehicles'
     and column_name not in ('vin', 'title_photo_path', 'authorization_document_path');
  execute format('grant select (%s) on public.vehicles to anon, authenticated', cols);
end;
$$;
