# MOVA

A cross-border vehicle marketplace connecting verified U.S. vehicle sellers with
international buyers, starting in Nigeria.

> **Status: Phase 0** — foundation scaffold. Authentication, role-based
> dashboards, the database schema, and the design-system primitives are in
> place. Listing creation, browsing, purchase requests, payments, and shipping
> integration land in Phases 1–4.

## Tech stack

| Area       | Choice                                            |
| ---------- | ------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + React 19                |
| Language   | TypeScript (strict)                               |
| Styling    | Tailwind CSS 3, `next/font` (Inter, JetBrains Mono) |
| Backend    | Supabase (Postgres, Auth, Row-Level Security)     |
| Auth       | `@supabase/ssr` cookie-based sessions             |
| Forms      | react-hook-form + zod                             |
| Icons      | lucide-react                                      |

## Prerequisites

- **Node.js 20+** (22 LTS recommended) and npm 10+
- A **Supabase** project (free tier is fine) — <https://supabase.com>

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   then fill in the two NEXT_PUBLIC_SUPABASE_* values (see below)

# 3. Set up the database (see "Database" below)

# 4. Run the dev server
npm run dev
```

The app runs at <http://localhost:3000>.

## Environment variables

Copy `.env.example` to `.env.local` and set:

| Variable                        | Required | Where to find it                                          |
| ------------------------------- | -------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | Supabase dashboard → Settings → API Keys → "Publishable and secret API keys" → publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY`     | for webhooks / admin actions | same tab → secret key (`sb_secret_…`); server-only, bypasses RLS |

`STRIPE_*` and `RESEND_API_KEY` are only needed for the flows that use them
(identity verification, buyer fee payments, shipper commission). Each Stripe
webhook has its **own** signing secret — `STRIPE_WEBHOOK_SECRET` (identity),
`STRIPE_PAYMENTS_WEBHOOK_SECRET` (buyer fees), and
`STRIPE_SHIPPER_COMMISSION_WEBHOOK_SECRET` (shipper commission +
`/shipper/signup` card setup). `SUPABASE_SERVICE_ROLE_KEY` is required for the
webhooks and for the admin "mark shipment completed" action (it charges the
shipper's saved card off-session).

`.env.local` is git-ignored — never commit real credentials.

## Database

The full Phase 0 schema lives in
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It
creates the enums, tables, Row-Level Security policies, and an
`on_auth_user_created` trigger that inserts a `public.users` row (with the role
from signup metadata) whenever a new `auth.users` record is created.

Apply it with whichever tool you use:

**Supabase CLI (recommended)**

```bash
npm install -g supabase        # if not already installed
supabase link --project-ref <your-project-ref>
supabase db push
```

**Or** paste the contents of `0001_init.sql` into the Supabase dashboard → SQL
Editor and run it once. Apply the numbered migrations in order.

### Storage

[`supabase/migrations/0002_vehicle_photos_storage.sql`](supabase/migrations/0002_vehicle_photos_storage.sql)
creates the public **`vehicle-photos`** bucket (10 MB per file; JPEG, PNG, WebP)
and its `storage.objects` policies: an authenticated seller may upload, replace
and delete objects only under their own `‹user-id›/…` key prefix, while reads are
public so approved-listing images need no signing. The seller upload UI lives in
the listing form and records each public URL in `public.vehicle_photos`
(`sort_order` for gallery order, one `is_primary` row per vehicle).

## Auth & route model

- `middleware.ts` refreshes the Supabase session on every request and guards
  route prefixes by role:
  - `/seller/**` → `seller`
  - `/buyer/**` → `buyer`
  - `/admin/**` → `admin`
- Unauthenticated users hitting a guarded route are redirected to
  `/login?next=<path>`; users with the wrong role are redirected to `/`.
- Email/password signup captures the role (`buyer` or `seller`) as user
  metadata; email verification returns through `/auth/callback`.
- Admin accounts are created directly in Supabase (no self-serve admin signup).
- Shippers sign in with a regular buyer/seller-style account and then "claim"
  their `shippers` record from `/shipper` by matching email — so like every
  other role, their login lives in the same `auth.users` table.
- Forgot/reset password (`/forgot-password` → email → `/auth/callback` →
  `/reset-password`) uses Supabase Auth's built-in `resetPasswordForEmail` /
  `updateUser`, so it works the same way for every role — there's no
  per-role password store to keep in sync. MOVA has no separate username;
  the account email doubles as the login, so there's no "forgot username"
  flow to build. The reset email's HTML is customized (see below) rather
  than using Supabase's default template.

## Scripts

| Command         | Description                              |
| --------------- | --------------------------------------- |
| `npm run dev`   | Start the dev server (hot reload)       |
| `npm run build` | Production build                        |
| `npm run start` | Serve the production build              |
| `npm run lint`  | Run ESLint (`eslint-config-next`)       |

## Project structure

```
app/
  page.tsx                 Landing page + design-system preview
  layout.tsx               Root layout, font wiring
  globals.css              Tailwind layers + base styles
  login/, signup/          Auth forms (client components)
  forgot-password/         Request a password reset link
  reset-password/          Set a new password from a reset link
  auth/callback/route.ts   Email-verification / password-reset code exchange
  seller/dashboard/        Role-gated dashboards (server components)
  buyer/dashboard/
  admin/dashboard/
components/ui/             Button, VerifiedBadge, VinData primitives
lib/supabase/              Browser, server, and middleware Supabase clients
lib/utils.ts               `cn()` class-name helper
types/database.ts          Hand-written types for the tables in use
supabase/migrations/       SQL schema + RLS
supabase/email-templates/  Custom auth email templates (see "Password reset
                            email template" under Deployment)
middleware.ts              Session refresh + role-based route guards
tailwind.config.ts         Design tokens (colors, spacing, fonts)
```

## Deployment

Deploy to any platform that supports Next.js 15 (Vercel is the smoothest).
Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the
`sb_publishable_…` key), and `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_…`
key, needed for the Stripe webhooks and admin actions) in the host's
environment, and add the deployed origin to Supabase → Authentication → URL
Configuration so email-verification and password-reset redirects resolve
correctly (both return through `/auth/callback`).

### Password reset email template

[`supabase/email-templates/recovery.html`](supabase/email-templates/recovery.html)
is a MOVA-branded replacement for Supabase's default "Reset Password" email
(table-based layout, inline styles, design-system colors — see the file's own
header comment for why table-based). It isn't picked up automatically; a
hosted Supabase project's email templates live in the platform's own config,
not this repo's migrations, so apply it by hand — either paste it into
Supabase dashboard → Authentication → Email Templates → **Reset Password**,
or push it via the Management API. Exact steps for both are in the file's
header comment.
