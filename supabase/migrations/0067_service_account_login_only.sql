-- 0067 — a login is a shipper only when it IS the shipper's login
-- (founder, 2026-10-08).
--
-- 0065 also counted a login as a shipper when an APPROVED shipper with no
-- login yet had that email as its contact email. The founder used their own
-- seller email as the contact on test shipper applications: approving one
-- would have turned that seller account into a "shipper" without anyone
-- linking it. From here on, only shippers.user_id / inspectors.user_id
-- decide. An approved shipper who applied before making an account still
-- signs in, opens the Shipper portal (no ID step under /shipper) and taps
-- "Claim", which sets user_id; from then on they're a shipper.
--
-- Replaces service_account_kind_for only; same signature, same grants.

create or replace function public.service_account_kind_for(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.shippers s where s.user_id = p_user) then 'shipper'
    when exists (select 1 from public.inspectors i where i.user_id = p_user) then 'inspector'
  end;
$$;
-- create or replace keeps 0065's grants; restated so this file stands alone.
revoke execute on function public.service_account_kind_for(uuid) from public, anon, authenticated;
