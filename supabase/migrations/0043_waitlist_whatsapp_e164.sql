-- MOVA — waitlist: WhatsApp numbers are always stored internationally.
--
-- "+" then 8-15 digits, not starting with 0 (E.164). The app normalises
-- every number to this form using the selected country
-- (lib/prelaunch.ts toInternationalWhatsapp), so this only stops a direct
-- API insert from storing a number nobody can dial.
--
-- Apply only AFTER the app build that normalises numbers is deployed: the
-- previous build stores nationally-typed numbers without "+", and its
-- inserts would start failing.
--
-- NOT VALID: any row stored by the previous build in the meantime is left
-- as it is rather than failing the migration; every new row is checked.

alter table public.waitlist_signups
  drop constraint waitlist_signups_whatsapp_check;
alter table public.waitlist_signups
  add constraint waitlist_signups_whatsapp_check
    check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$') not valid;
