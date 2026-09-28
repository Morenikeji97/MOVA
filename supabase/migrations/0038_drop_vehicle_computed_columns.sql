-- MOVA — drop the computed columns replaced in 0036.
--
-- Apply only after the app build that uses vin_masked / has_*_document /
-- seller_identity_verified / vehicle_vin() is deployed and verified. Until
-- then these stay, so rolling 0037 back (re-granting table-level SELECT)
-- restores the previous build unchanged. Under 0037's column-level grants
-- they can't be called by anon/authenticated anyway: PostgREST passes the
-- whole row, which needs SELECT on every column.

-- Retire the computed columns -------------------------------------------
-- Nothing in the app references these any more (it moved to the 0036
-- columns).
drop function public.vehicle_vin_display(public.vehicles);
drop function public.vehicle_has_title_document(public.vehicles);
drop function public.vehicle_has_authorization_document(public.vehicles);
drop function public.vehicle_seller_identity_verified(public.vehicles);
