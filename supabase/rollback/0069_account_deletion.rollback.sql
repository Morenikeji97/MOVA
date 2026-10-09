-- Rollback for 0069. Anonymised accounts can't be restored (that's the point);
-- this only removes the new function and table.
drop function if exists public.anonymize_account(uuid);
drop table if exists public.account_deletion_requests;
