-- 0066 — run 0065's "shipper/inspector can't reserve" check first.
--
-- Postgres runs a table's BEFORE triggers in name order, so 0065's
-- purchase_requests_refuse_service_accounts ran after the pre-launch guard
-- and a shipper got "reservations are closed" instead of "shipper accounts
-- can't reserve" (both refuse; the reason was wrong, and it would only show
-- after launch). Renaming the trigger puts it first. Nothing else changes.

alter trigger purchase_requests_refuse_service_accounts on public.purchase_requests
  rename to purchase_requests_0_refuse_service_accounts;
