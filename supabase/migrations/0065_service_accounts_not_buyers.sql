-- 0065 — shipper and inspector accounts aren't buyers (founder, 2026-10-07).
--
-- Shippers and inspectors sign in with ordinary (buyer-role) logins; there's
-- no separate role. Until now that meant a US shipper signing in was told to
-- verify a Nigerian ID. From here on, any login linked to a shipper
-- application/company or an inspector application is a "service account":
--   * never sent to Verify your ID; lands on its own portal after sign-in
--     (middleware.ts, /auth/landing, lib/account-kind.ts);
--   * can browse public pages like anyone;
--   * can't reserve a car or start a buyer chat — enforced here, whatever
--     the browser sends, and not tied to the pre-launch ID switch.
--
-- "Linked" means shippers.user_id / inspectors.user_id is the login, or an
-- unclaimed shipper application (user_id still empty) whose contact email is
-- the login's confirmed email — so a shipper who applied before making an
-- account isn't sent to Verify ID before they claim it. Any status counts
-- (pending, approved, rejected, suspended).
--
-- New functions and triggers only; nothing existing is changed.

create or replace function public.service_account_kind_for(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.shippers s where s.user_id = p_user) then 'shipper'
    when exists (select 1 from public.inspectors i where i.user_id = p_user) then 'inspector'
    when exists (
      select 1 from public.shippers s
      join auth.users u on u.id = p_user
      where s.user_id is null
        and u.email_confirmed_at is not null
        and lower(s.contact_email) = lower(u.email)
    ) then 'shipper'
  end;
$$;
-- Internal: only the triggers below (security definer) call it with any id.
revoke execute on function public.service_account_kind_for(uuid) from public, anon, authenticated;

-- What the signed-in user is: 'shipper', 'inspector' or null (a plain
-- buyer/seller). Only ever about the caller.
create or replace function public.my_service_account_kind()
returns text language sql stable security definer set search_path = '' as $$
  select public.service_account_kind_for(auth.uid());
$$;
revoke execute on function public.my_service_account_kind() from public, anon;
grant execute on function public.my_service_account_kind() to authenticated;

-- Reserving: a service account can't be the buyer.
create or replace function public.purchase_requests_refuse_service_accounts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if public.service_account_kind_for(new.buyer_id) is not null then
    raise exception 'service_account_not_buyer'
      using errcode = 'check_violation',
            hint = 'Shipper and inspector accounts can''t reserve cars.';
  end if;
  return new;
end;
$$;
drop trigger if exists purchase_requests_refuse_service_accounts on public.purchase_requests;
create trigger purchase_requests_refuse_service_accounts
  before insert on public.purchase_requests
  for each row execute function public.purchase_requests_refuse_service_accounts();

-- Buyer chat: a service account can't open a conversation as the buyer.
create or replace function public.conversations_refuse_service_accounts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if public.service_account_kind_for(new.buyer_id) is not null then
    raise exception 'service_account_not_buyer'
      using errcode = 'check_violation',
            hint = 'Shipper and inspector accounts can''t message sellers as a buyer.';
  end if;
  return new;
end;
$$;
drop trigger if exists conversations_refuse_service_accounts on public.conversations;
create trigger conversations_refuse_service_accounts
  before insert on public.conversations
  for each row execute function public.conversations_refuse_service_accounts();
