-- MOVA — Dispute reporting + admin review
--
-- Implements the "Dispute Resolution Process" already promised in the
-- published Buyer Protection & Refund Policy (lib/policy-content.ts §6):
-- "A buyer or seller may file a dispute through the MOVA platform,
-- describing the issue and providing supporting evidence." This is that
-- mechanism, plus the admin side that reviews it. It records a decision
-- only — it does not call Stripe or move money; real refunds (Stripe
-- dashboard, or a manual bank transfer for bank-transfer payments) happen
-- outside the app, and "Mark refund completed" is purely for record-keeping
-- after that's done by hand.
--
-- STATUS FLOW:
--   open -> approved_pending_refund -> refund_completed
--   open -> denied
-- Transition ordering (no skipping/double-processing a decision) is
-- enforced in the admin server actions via filtered .eq("status", …)
-- updates — the same idempotency idiom already used by
-- confirmBankTransferPayment/rejectBankTransferPayment (0014) — not by a DB
-- trigger; see the RLS section below for why none is needed here.
--
-- RLS SHAPE — simpler than the purchase_requests guard-trigger pattern
-- (0010/0011/0014): there, buyer/seller/admin all had partial legitimate
-- write access to the SAME row, which is what forced column-level trigger
-- enforcement. Here there's no overlap at all — a reporter may only INSERT
-- (never UPDATE their own dispute afterward), and only an admin may UPDATE
-- (decide/complete) at all. That split lets plain row-level RLS do the
-- whole job:
--   - INSERT: reporter_id must be the caller, the caller must actually be
--     the buyer or the seller on the referenced reservation, and every
--     decision-shaped column (status, decided_by, decision_reason,
--     decision_amount_usd, decided_at, refund_completed_at) must be exactly
--     its default/open value. That last part is what blocks a buyer
--     self-inserting an already-"approved" or already-"decided" dispute —
--     without it, a crafted insert (not just a later update) could forge a
--     decision, since there'd be no UPDATE step to catch.
--   - UPDATE: admin only, full stop. No buyer/seller UPDATE policy exists
--     at any column, so there's nothing for a trigger to additionally
--     guard.
--   - SELECT: buyer, the vehicle's seller, or admin — exact mirror of the
--     existing "transaction history read" policy (0001) for the same
--     reservation, so either party can see a dispute exists against their
--     reservation and how it was decided, not just whoever filed it.
--   - No DELETE for anyone — permanent record, same as policy_acceptances
--     and bank-transfer proofs.
--
-- EVIDENCE: a new private storage bucket, dispute-evidence. Object key is
-- <uploader uid>/<uuid>.<ext> — no reservation-id path segment (unlike
-- bank-transfer-proofs), because the dispute row doesn't exist yet at
-- upload time; disputes.evidence_paths is what ties files to a dispute,
-- the same way vehicle_photos ties photos to a vehicle via a table rather
-- than the storage path. Read is reporter-or-admin only (not the
-- counterparty) — same restriction bank-transfer proofs got, so a buyer's
-- "seller unresponsive" evidence isn't auto-exposed to that seller before
-- MOVA has reviewed it. The dispute row itself (category/description/
-- status/decision) is still visible to both parties per the SELECT policy
-- above; it's only the raw uploaded files that stay reporter+admin-only.

create type dispute_category as enum (
  'seller_unresponsive',
  'vehicle_misrepresented',
  'shipping_issue',
  'other'
);

create type dispute_status as enum (
  'open',
  'approved_pending_refund',
  'denied',
  'refund_completed'
);

create table public.disputes (
  id uuid primary key default uuid_generate_v4(),
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  reporter_id uuid not null references public.users(id),
  category dispute_category not null,
  description text not null,
  evidence_paths text[] not null default '{}',
  status dispute_status not null default 'open',
  decided_by uuid references public.users(id),
  decision_reason text,
  decision_amount_usd numeric(12,2),
  decided_at timestamptz,
  refund_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index disputes_purchase_request_idx on public.disputes (purchase_request_id);
create index disputes_open_idx on public.disputes (created_at) where status = 'open';

alter table public.disputes enable row level security;

create policy "disputes read" on public.disputes
  for select using (
    exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_id
      and (pr.buyer_id = auth.uid()
           or exists (select 1 from public.vehicles v where v.id = pr.vehicle_id and v.seller_id = auth.uid())
           or public.is_admin())
    )
  );

create policy "disputes reporter insert" on public.disputes
  for insert with check (
    reporter_id = auth.uid()
    and status = 'open'
    and decided_by is null
    and decision_reason is null
    and decision_amount_usd is null
    and decided_at is null
    and refund_completed_at is null
    and exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_id
      and (pr.buyer_id = auth.uid()
           or exists (select 1 from public.vehicles v where v.id = pr.vehicle_id and v.seller_id = auth.uid()))
    )
  );

create policy "disputes admin update" on public.disputes
  for update using (public.is_admin()) with check (public.is_admin());

-- Storage bucket -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dispute-evidence',
  'dispute-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dispute evidence owner insert" on storage.objects;
create policy "dispute evidence owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dispute-evidence'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "dispute evidence owner or admin read" on storage.objects;
create policy "dispute evidence owner or admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or public.is_admin()
    )
  );

-- No update/delete policy for anyone (including the uploader) — evidence is
-- permanent once submitted, same as bank-transfer-proofs and
-- policy_acceptances.
