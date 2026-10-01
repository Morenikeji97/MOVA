# Admin two-step sign-in: setup and lost-phone recovery

Admin accounts need a password **and** a 6-digit code from an authenticator app
(TOTP) to sign in. Without the code, the account has ordinary-user rights only.
That's enforced on every page (`middleware.ts`), in every admin action
(`lib/admin-mfa.ts`) and in the database (`is_admin()`, migration 0048).

## Setting it up

1. Install **Google Authenticator** (or Microsoft Authenticator, 1Password,
   Bitwarden: any app that shows 6-digit codes). In Google Authenticator, sign
   in with your Google account so your codes are backed up.
2. Sign in to ShipMova with your admin email and password. You land on
   **Set up two-step sign-in**.
3. On the phone, tap **Add to authenticator app**. On another device, scan the
   QR code. Enter the 6-digit code it shows.
4. You land on **Two-step sign-in** (`/admin/security`). Tap **Add a backup
   authenticator** and repeat on a second app or device: a tablet, an old
   phone, or a password manager.

From then on every sign-in asks for a code after the password. The code covers
that whole session. A code from either authenticator works.

## Replacing a phone you still have

1. Sign in with a code from the old phone.
2. Open **Admin dashboard → Two-step sign-in**, tap **Add another
   authenticator**, and set up the new phone.
3. **Remove** the old phone's entry.

## Lost phone, backup authenticator available

1. Sign in with a code from the backup.
2. **Admin dashboard → Two-step sign-in**: **Remove** the lost phone's entry,
   then **Add another authenticator** for the new phone.

If Google Authenticator's backup was on, installing it on the new phone and
signing in to the same Google account brings the codes back. Remove the old
entry anyway if the lost phone could be found by someone else.

## Lost phone, no backup: the Supabase dashboard

This removes **all** authenticators from the account so you can set up again.
It needs owner access to the Supabase dashboard. That login is the master key
to admin access, so keep its own 2FA on.

1. Open the project's SQL editor:
   https://supabase.com/dashboard/project/dplwwsednwkcvhgnuvgw/sql/new
2. Run, with your admin email in place of the placeholder:

   ```sql
   delete from auth.mfa_factors
   where user_id = (select id from auth.users where email = 'YOUR-ADMIN-EMAIL');
   ```

   It should report the number of authenticators removed (1 or more).
3. Sign in to ShipMova with your email and password. You're asked to set up
   two-step sign-in again. Do it, and add a backup this time.

A password reset by email doesn't skip the code: an admin still enters a code
before reaching anything, including the new-password page. The Supabase
dashboard is the only way around it.

## If someone else may have your password

Reset the password (Forgot password on the sign-in page). Without your
authenticator they can't get past the code page, but change the password anyway.
