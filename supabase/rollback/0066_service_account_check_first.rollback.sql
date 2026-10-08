-- Rollback for 0066: restore the trigger's 0065 name (it then runs after the
-- pre-launch guard again). Run as the database owner.
alter trigger purchase_requests_0_refuse_service_accounts on public.purchase_requests
  rename to purchase_requests_refuse_service_accounts;
