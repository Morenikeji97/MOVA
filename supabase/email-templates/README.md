# MOVA auth emails — Supabase dashboard setup

Supabase sends MOVA's sign-up, sign-in, email-change, invite and password-reset
emails. The HTML for each lives here; Supabase doesn't read these files, so
they're applied by hand in the dashboard. Project: `dplwwsednwkcvhgnuvgw`.

**Order matters.** Do steps 1–3 first (sender, allowed addresses, rate limit),
then step 4 (templates). The new templates link to `/auth/confirm`, which only
exists once the `branded-auth-emails` change is deployed: paste them just
before testing on the deploy preview, or right after merging. If they're live
while shipmova.com still runs the old build, emails sent from shipmova.com
will have broken links until the merge deploys. Nothing depends on that while
MOVA is in pre-launch.

## 1. Send from noreply@shipmova.com through Resend (custom SMTP)

Prerequisite: shipmova.com shows **Verified** at https://resend.com/domains.

1. Create a key at https://resend.com/api-keys → **Create API key**.
   - Name: `Supabase SMTP (MOVA)`
   - Permission: **Sending access**
   - Domain: `shipmova.com`
   - Copy the key (starts `re_`). It's shown once. Don't paste it anywhere else.
2. Open https://supabase.com/dashboard/project/dplwwsednwkcvhgnuvgw/auth/smtp
   (Authentication → Emails → **SMTP Settings**).
3. Turn on **Enable Custom SMTP** and fill in:

   | Field | Value |
   |---|---|
   | Sender email | `noreply@shipmova.com` |
   | Sender name | `MOVA` |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Username | `resend` |
   | Password | the Resend API key from step 1 |
   | Minimum interval between emails | leave the default |

4. **Save**.

## 2. Site URL and allowed redirect addresses

Open https://supabase.com/dashboard/project/dplwwsednwkcvhgnuvgw/auth/url-configuration
(Authentication → **URL Configuration**).

1. **Site URL:** `https://shipmova.com` → **Save**.
2. **Redirect URLs** → **Add URL**, one at a time (keep any existing entries):
   - `https://shipmova.com/**`
   - `https://deploy-preview-*--mova-marketplace.netlify.app/**`
   - `http://localhost:3000/**` (local development only; optional)

   The app sends its own address with every email request. Supabase only uses
   it if it matches this list, and otherwise falls back to the Site URL, so
   emails requested on a deploy preview link back to that preview.

## 3. Raise the email rate limit (after custom SMTP is on)

Supabase's built-in sender allows only a couple of emails an hour, and only to
the project's own team members. Once custom SMTP is saved, the limit becomes
editable.

1. Open https://supabase.com/dashboard/project/dplwwsednwkcvhgnuvgw/auth/rate-limits
   (Authentication → **Rate Limits**).
2. **Rate limit for sending emails:** `100` per hour (raise later if needed).
   Resend's own plan limits still apply.
3. **Save**.

## 4. Templates

Open https://supabase.com/dashboard/project/dplwwsednwkcvhgnuvgw/auth/templates
(Authentication → Emails → **Templates**). For each row below: select the
template, set **Subject**, replace the whole **Message body** with the file's
contents *from the `<!DOCTYPE html>` line down* (skip the `<!-- … -->` notes at
the top), and **Save**.

| Dashboard template | Subject | File |
|---|---|---|
| Confirm signup | `Confirm your MOVA account` | `confirm-signup.html` |
| Invite user | `You're invited to MOVA` | `invite.html` |
| Magic link | `Your MOVA sign-in link` | `magic-link.html` |
| Change email address | `Confirm your new MOVA email` | `change-email.html` |
| Reset password | `Reset your MOVA password` | `recovery.html` |

(Leave "Reauthentication" as is. MOVA doesn't use it.)

Every link has the form
`{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>`.
`/auth/confirm` verifies the link on the MOVA site and signs the user in:

| Type | Lands on |
|---|---|
| `email` (confirm signup), `magiclink` | the user's dashboard (buyer, seller, admin or shipper) |
| `email_change` | the user's dashboard |
| `recovery`, `invite` | `/reset-password`, to choose a password |
| expired, used or malformed link | `/auth/link-expired`, with the right next step |

## 5. Check it

Sign up at https://shipmova.com/signup (or on a deploy preview) with an email
you can read. The email should come from **MOVA &lt;noreply@shipmova.com&gt;**,
show the MOVA logo, and its button link should start with the site you signed
up on, never `supabase.co`.
