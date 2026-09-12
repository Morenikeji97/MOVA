-- MOVA — harden the VIN-verification functions added in 0007, per the
-- security advisor run right after that migration.

-- mask_vin had no pinned search_path (function_search_path_mutable lint).
create or replace function public.mask_vin(vin text, keep int default 6)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when vin is null then null
    when length(vin) <= keep then vin
    else repeat('•', length(vin) - keep) || right(vin, keep)
  end;
$$;

-- vehicles_guard_admin_only_fields is a trigger function only — it should
-- never be directly callable via RPC (it errors if invoked outside a trigger
-- context anyway, since its return type is `trigger`, but Postgres grants
-- EXECUTE to PUBLIC by default on new functions, which the advisor flags).
revoke execute on function public.vehicles_guard_admin_only_fields() from public, anon, authenticated;
