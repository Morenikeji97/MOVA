-- Rollback for 0068: drops the new table (and its policies and seed rows).
-- Nothing else depended on it before 0068.
drop table if exists public.landed_cost_rates;
