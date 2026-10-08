-- Rollback for migration 0065_service_accounts_not_buyers.sql. 0065 only
-- adds new functions and triggers, so rolling back removes them; no data is
-- touched. Note: the app (middleware.ts) calls my_service_account_kind() and
-- treats an error as "not a service account", so shippers would be sent to
-- Verify your ID again after this rollback.
--
-- Run as the database owner (Supabase SQL editor), in one transaction.

begin;

drop trigger if exists purchase_requests_refuse_service_accounts on public.purchase_requests;
drop trigger if exists purchase_requests_0_refuse_service_accounts on public.purchase_requests; -- name since 0066
drop trigger if exists conversations_refuse_service_accounts on public.conversations;
drop function if exists public.purchase_requests_refuse_service_accounts();
drop function if exists public.conversations_refuse_service_accounts();
drop function if exists public.my_service_account_kind();
drop function if exists public.service_account_kind_for(uuid);

commit;
