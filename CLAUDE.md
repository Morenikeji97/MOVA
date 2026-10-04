# CLAUDE.md

## ShipMova operating standard (required) — full text: docs/mobile-first-requirement.md
Brand is "ShipMova" — never "MOVA" in anything user-facing.

Two goals:
1. The founder and staff can run ~95% of daily operations from a phone: ShipMova is the single source of truth for every transaction (ID "SM-000001", full stage history), exceptions surface in an Action Required queue, and admin screens are mobile-first cards/queues, not shrunken tables.
2. Buyers and sellers (assume many on Android phones and metered data) get fast, light pages.

Before building or changing anything, answer:
1. Does it work properly on mobile?
2. Does it keep ShipMova as the source of truth?
3. Does it fit the transaction lifecycle (stages are data-driven, not hard-coded)?
4. Does it write the audit trail for admin/sensitive actions?
5. Are permissions enforced server-side / by RLS (never UI-only)?
6. Does it open a security hole (sensitive actions need reauth/MFA)?
7. Can staff use it without the founder?
8. Can it scale without a rebuild?
9. Is it needed now, or is it over-building before launch?

Payments: ShipMova never custodies vehicle funds — the car price goes through Escrow.com.

Mobile engineering rules:
- Build the 360px layout first with unprefixed Tailwind classes; widen with
  sm:/md:/lg:. Nothing may scroll horizontally at 320px.
- Tap targets ≥ 44px (h-11). No hover-only controls.
- Form fields use text-base (16px) or larger, plus the right type / inputMode / autoComplete.
- Never serve original uploads to cards or galleries: use resized images,
  loading="lazy", video preload="none". Paginate every list.
- Server components by default; "use client" only on the smallest
  interactive leaf. Anything that polls pauses when the tab is hidden.
- Before calling a UI change done, check it at 360px, 320px and one desktop
  width, and say so in the PR description.

Test data and the shared database (standing rule):
- Production and every deploy preview share ONE Supabase project.
- Never make test data visible on shipmova.com (approving a test listing, or
  any other row the public can see) without asking the founder first.
- Never act as the founder's admin account in the database (e.g. setting
  request.jwt.claims to their user id / aal2) without asking first.
- Private test data (drafts, uploads that are cleaned up) is fine; list
  anything kept under "Pre-launch cleanup" in docs/LAUNCH-BLOCKERS.md.

Known gaps and priorities: docs/architecture-review.md.
