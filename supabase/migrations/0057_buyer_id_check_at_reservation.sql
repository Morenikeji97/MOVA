-- Buyers verify their ID (NIN, or BVN) only when they reserve — not to sign
-- up or browse.
--
-- platform_settings.require_buyer_id_check is the switch, off until launch:
-- Dojah is still in sandbox, so nobody can verify yet, and reservations are
-- closed pre-launch anyway (0039). On launch day it goes on together with
-- Dojah's live keys (docs/LAUNCH-BLOCKERS.md). While it's on, the database
-- refuses a reservation from a buyer whose buyer_profiles.verification_status
-- isn't 'verified' — the app checks first for a friendly message
-- (app/browse/[id]/actions.ts), this makes it binding.

alter table public.platform_settings
  add column if not exists require_buyer_id_check boolean not null default false;

create or replace function public.is_buyer_id_check_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select require_buyer_id_check from public.platform_settings where id), false);
$$;
grant execute on function public.is_buyer_id_check_required() to anon, authenticated;

create or replace function public.purchase_requests_require_buyer_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if public.is_buyer_id_check_required() and not exists (
    select 1 from public.buyer_profiles b
    where b.user_id = new.buyer_id and b.verification_status = 'verified'
  ) then
    raise exception 'buyer_id_check_required'
      using errcode = 'check_violation',
            hint = 'Verify your ID (NIN) on your dashboard before reserving.';
  end if;
  return new;
end;
$$;
revoke execute on function public.purchase_requests_require_buyer_id() from public, anon, authenticated;

drop trigger if exists purchase_requests_require_buyer_id on public.purchase_requests;
create trigger purchase_requests_require_buyer_id
  before insert on public.purchase_requests
  for each row execute function public.purchase_requests_require_buyer_id();
