-- Admin access requires a two-step (TOTP) sign-in.
--
-- is_admin() now also requires the caller's session to be at Supabase Auth
-- assurance level aal2, i.e. the admin entered an authenticator code after
-- their password in this session. A session at aal1 — a phished or reused
-- password alone — gets ordinary-user rights from every RLS policy and guard
-- trigger that calls is_admin(), not admin ones.
--
-- This is the database half. The app half: middleware.ts sends an admin
-- without a code-checked session to /mfa on every page, and every admin
-- server action (some use the service-role key, which bypasses RLS) checks
-- the same aal2 claim via lib/admin-mfa.ts.
--
-- Lost phone: docs/admin-mfa-recovery.md.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    );
$$;
