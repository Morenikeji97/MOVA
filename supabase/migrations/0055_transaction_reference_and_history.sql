-- Transaction reference ("SM-000001") and append-only stage history
-- (MVP NOW #3, docs/architecture-review.md §1–2 and §2.1–2.2).
--
-- purchase_requests stays the transaction root (disputes, reviews,
-- shipments and history already point at it); this gives it:
--   - reference: a human ID staff and buyers can say on the phone, assigned
--     by a trigger from a sequence, never chosen by a client, never changed;
--   - escrow_reference / escrow_stage: what Escrow.com reports, recorded by
--     an admin. ShipMova still never holds vehicle funds.
--
-- transaction_status_history becomes the single timeline. Stages are plain
-- text ("reservation.verified", "fee.paid", "escrow.escrow_funded",
-- "shipping.picked_up", "dispute.open"), so a new stage never needs
-- `alter type`. Rows are written only by the triggers below; nobody can
-- insert, edit or delete them through the API, and the history outlives
-- both the reservation (on delete restrict) and the accounts in it
-- (changed_by is a plain uuid, no FK).

-- The reservation guard reverts updates that aren't from an admin, the
-- service role, the buyer or the seller, so the backfill below runs as the
-- service role (transaction-local).
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- ── Reference ──────────────────────────────────────────────────────────────
create sequence if not exists public.transaction_reference_seq;

create or replace function public.next_transaction_reference()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'SM-' || lpad(nextval('public.transaction_reference_seq')::text, 6, '0');
$$;
revoke execute on function public.next_transaction_reference() from public, anon, authenticated;

alter table public.purchase_requests add column if not exists reference text;

-- Backfill existing reservations oldest first, so SM-000001 is the first deal.
do $$
declare r record;
begin
  for r in select id from public.purchase_requests where reference is null order by created_at, id loop
    update public.purchase_requests set reference = public.next_transaction_reference() where id = r.id;
  end loop;
end $$;

alter table public.purchase_requests alter column reference set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_requests_reference_key') then
    alter table public.purchase_requests add constraint purchase_requests_reference_key unique (reference);
  end if;
end $$;

-- Assigned on insert whatever the client sent; frozen on update for everyone.
create or replace function public.purchase_requests_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.reference := public.next_transaction_reference();
  else
    new.reference := old.reference;
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_requests_reference on public.purchase_requests;
create trigger purchase_requests_reference
  before insert or update on public.purchase_requests
  for each row execute function public.purchase_requests_reference();

-- ── Escrow fields (admin-recorded) ─────────────────────────────────────────
alter table public.purchase_requests
  add column if not exists escrow_reference text check (char_length(escrow_reference) <= 100),
  add column if not exists escrow_stage text check (
    escrow_stage in ('escrow_opened', 'escrow_funded', 'inspection_passed', 'handed_to_shipper', 'escrow_released')
  );

-- purchase_requests_guard_negotiation(): the live body (0051) plus pinning
-- escrow_reference and escrow_stage on both non-admin paths. (reference is
-- pinned for everyone by its own trigger above.)
create or replace function public.purchase_requests_guard_negotiation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if exists (
    select 1 from public.vehicles v
    where v.id = old.vehicle_id and v.seller_id = auth.uid()
  ) then
    if old.negotiated_price_status <> 'accepted'
       and new.negotiated_price_status = 'proposed'
       and new.negotiated_price_usd is not null
       and new.negotiated_price_usd > 0
       and new.negotiated_price_usd < coalesce(
             old.vehicle_price_usd,
             (select price_usd from public.vehicles where id = old.vehicle_id)
           )
       and old.status in ('submitted', 'under_review', 'verified')
    then
      new.negotiated_price_proposed_at := now();
      new.negotiated_price_accepted_at := old.negotiated_price_accepted_at;
    else
      new.negotiated_price_usd := old.negotiated_price_usd;
      new.negotiated_price_status := old.negotiated_price_status;
      new.negotiated_price_proposed_at := old.negotiated_price_proposed_at;
      new.negotiated_price_accepted_at := old.negotiated_price_accepted_at;
    end if;

    new.vehicle_id := old.vehicle_id;
    new.buyer_id := old.buyer_id;
    new.shipping_rate_id := old.shipping_rate_id;
    new.status := old.status;
    new.vehicle_price_usd := old.vehicle_price_usd;
    new.mova_fee_usd := old.mova_fee_usd;
    new.mova_fee_payment_status := old.mova_fee_payment_status;
    new.mova_fee_stripe_session_id := old.mova_fee_stripe_session_id;
    new.mova_fee_checkout_url := old.mova_fee_checkout_url;
    new.mova_fee_payment_method_fingerprint := old.mova_fee_payment_method_fingerprint;
    new.fee_payment_requested_at := old.fee_payment_requested_at;
    new.payment_method := old.payment_method;
    new.payment_reference := old.payment_reference;
    new.bank_transfer_proof_path := old.bank_transfer_proof_path;
    new.bank_transfer_proof_uploaded_at := old.bank_transfer_proof_uploaded_at;
    new.bank_transfer_reviewed_by := old.bank_transfer_reviewed_by;
    new.bank_transfer_reviewed_at := old.bank_transfer_reviewed_at;
    new.bank_transfer_rejection_reason := old.bank_transfer_rejection_reason;
    new.escrow_reference := old.escrow_reference;
    new.escrow_stage := old.escrow_stage;
    new.notes := old.notes;
    new.assigned_admin_id := old.assigned_admin_id;
    new.created_at := old.created_at;
    return new;
  end if;

  if old.buyer_id = auth.uid() then
    if old.negotiated_price_status = 'proposed'
       and new.negotiated_price_status = 'accepted'
    then
      new.negotiated_price_accepted_at := now();
      new.negotiated_price_usd := old.negotiated_price_usd;
      new.negotiated_price_proposed_at := old.negotiated_price_proposed_at;
    else
      new.negotiated_price_status := old.negotiated_price_status;
      new.negotiated_price_usd := old.negotiated_price_usd;
      new.negotiated_price_proposed_at := old.negotiated_price_proposed_at;
      new.negotiated_price_accepted_at := old.negotiated_price_accepted_at;
    end if;

    if old.mova_fee_payment_status in ('pending', 'bank_transfer_rejected')
       and new.mova_fee_payment_status = 'pending_manual_verification'
       and new.payment_method = 'bank_transfer'
       and new.bank_transfer_proof_path is not null
       and new.bank_transfer_proof_path is distinct from old.bank_transfer_proof_path
    then
      new.bank_transfer_proof_uploaded_at := now();
      new.bank_transfer_reviewed_by := null;
      new.bank_transfer_reviewed_at := null;
      new.bank_transfer_rejection_reason := null;
    else
      new.mova_fee_payment_status := old.mova_fee_payment_status;
      new.payment_method := old.payment_method;
      new.bank_transfer_proof_path := old.bank_transfer_proof_path;
      new.bank_transfer_proof_uploaded_at := old.bank_transfer_proof_uploaded_at;
      new.bank_transfer_reviewed_by := old.bank_transfer_reviewed_by;
      new.bank_transfer_reviewed_at := old.bank_transfer_reviewed_at;
      new.bank_transfer_rejection_reason := old.bank_transfer_rejection_reason;
    end if;

    if old.mova_fee_checkout_url is null
       and new.shipping_rate_id is distinct from old.shipping_rate_id
       and (
         new.shipping_rate_id is null
         or exists (
           select 1
           from public.shipping_rates sr
           join public.vehicles v on v.id = old.vehicle_id
           where sr.id = new.shipping_rate_id
             and sr.active
             and sr.vehicle_size_type = v.vehicle_size_type
         )
       )
    then
      null;
    else
      new.shipping_rate_id := old.shipping_rate_id;
    end if;

    new.mova_fee_payment_method_fingerprint := old.mova_fee_payment_method_fingerprint;
    new.escrow_reference := old.escrow_reference;
    new.escrow_stage := old.escrow_stage;
    new.vehicle_id := old.vehicle_id;
    new.buyer_id := old.buyer_id;
    new.status := old.status;
    new.vehicle_price_usd := old.vehicle_price_usd;
    new.mova_fee_usd := old.mova_fee_usd;
    new.mova_fee_stripe_session_id := old.mova_fee_stripe_session_id;
    new.mova_fee_checkout_url := old.mova_fee_checkout_url;
    new.fee_payment_requested_at := old.fee_payment_requested_at;
    new.payment_reference := old.payment_reference;
    new.notes := old.notes;
    new.assigned_admin_id := old.assigned_admin_id;
    new.created_at := old.created_at;
    return new;
  end if;

  return old;
end;
$$;

-- ── Stage history: text stages, append-only, trigger-written ───────────────
alter table public.transaction_status_history
  add column if not exists stage text,
  add column if not exists from_stage text;

-- Empty in every environment (nothing ever wrote to it), so the enum column
-- can go rather than be migrated.
alter table public.transaction_status_history drop column if exists status;
alter table public.transaction_status_history alter column stage set not null;
alter table public.transaction_status_history
  add constraint transaction_status_history_stage_format check (stage ~ '^[a-z_]+\.[a-z_]+$');

-- History outlives the reservation's deletion attempts and the accounts in it.
alter table public.transaction_status_history
  drop constraint if exists transaction_status_history_purchase_request_id_fkey;
alter table public.transaction_status_history
  add constraint transaction_status_history_purchase_request_id_fkey
  foreign key (purchase_request_id) references public.purchase_requests(id) on delete restrict;
alter table public.transaction_status_history
  drop constraint if exists transaction_status_history_changed_by_fkey;

-- Stable order: one change can record several stages in the same instant.
alter table public.transaction_status_history
  add column if not exists seq bigint generated always as identity;

create index if not exists transaction_status_history_pr_idx
  on public.transaction_status_history (purchase_request_id, seq);

-- Only the triggers write: no insert policy, no write grants.
drop policy if exists "transaction history admin insert" on public.transaction_status_history;
revoke insert, update, delete, truncate on public.transaction_status_history from anon, authenticated;

create or replace function public.transaction_history_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'transaction_status_history is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists transaction_history_append_only on public.transaction_status_history;
create trigger transaction_history_append_only
  before update or delete on public.transaction_status_history
  for each row execute function public.transaction_history_append_only();

create or replace function public.record_transaction_stage(
  p_purchase_request_id uuid,
  p_stage text,
  p_from_stage text,
  p_note text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.transaction_status_history (purchase_request_id, stage, from_stage, changed_by, note)
  values (p_purchase_request_id, p_stage, p_from_stage, auth.uid(), p_note);
$$;
revoke execute on function public.record_transaction_stage(uuid, text, text, text) from public, anon, authenticated;

-- Reservations: status, fee, negotiated price, escrow.
create or replace function public.purchase_requests_record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_transaction_stage(new.id, 'reservation.' || new.status, null);
    return null;
  end if;

  if new.status is distinct from old.status then
    perform public.record_transaction_stage(new.id, 'reservation.' || new.status, 'reservation.' || old.status);
  end if;
  if new.mova_fee_payment_status is distinct from old.mova_fee_payment_status then
    perform public.record_transaction_stage(new.id, 'fee.' || new.mova_fee_payment_status, 'fee.' || old.mova_fee_payment_status);
  end if;
  if new.negotiated_price_status is distinct from old.negotiated_price_status then
    perform public.record_transaction_stage(new.id, 'price.' || new.negotiated_price_status, 'price.' || old.negotiated_price_status);
  end if;
  if new.escrow_stage is distinct from old.escrow_stage then
    perform public.record_transaction_stage(
      new.id,
      'escrow.' || coalesce(new.escrow_stage, 'cleared'),
      case when old.escrow_stage is null then null else 'escrow.' || old.escrow_stage end
    );
  end if;
  if new.escrow_reference is distinct from old.escrow_reference then
    perform public.record_transaction_stage(new.id, 'escrow.reference_recorded', null, new.escrow_reference);
  end if;
  return null;
end;
$$;

drop trigger if exists purchase_requests_record_history on public.purchase_requests;
create trigger purchase_requests_record_history
  after insert or update on public.purchase_requests
  for each row execute function public.purchase_requests_record_history();

-- Shipments: shipper chosen, pickup → transit → delivered, completed.
create or replace function public.shipment_requests_record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_transaction_stage(new.purchase_request_id, 'shipping.shipper_selected', null, new.shipper_company_name);
    return null;
  end if;
  if new.shipping_status is distinct from old.shipping_status then
    perform public.record_transaction_stage(new.purchase_request_id, 'shipping.' || new.shipping_status, 'shipping.' || old.shipping_status);
  end if;
  if new.status is distinct from old.status then
    perform public.record_transaction_stage(new.purchase_request_id, 'shipment.' || new.status, 'shipment.' || old.status);
  end if;
  return null;
end;
$$;

drop trigger if exists shipment_requests_record_history on public.shipment_requests;
create trigger shipment_requests_record_history
  after insert or update on public.shipment_requests
  for each row execute function public.shipment_requests_record_history();

-- Disputes: filed and each decision.
create or replace function public.disputes_record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_transaction_stage(new.purchase_request_id, 'dispute.' || new.status, null);
  elsif new.status is distinct from old.status then
    perform public.record_transaction_stage(new.purchase_request_id, 'dispute.' || new.status, 'dispute.' || old.status);
  end if;
  return null;
end;
$$;

drop trigger if exists disputes_record_history on public.disputes;
create trigger disputes_record_history
  after insert or update on public.disputes
  for each row execute function public.disputes_record_history();

-- Trigger functions aren't API endpoints.
revoke execute on function public.purchase_requests_reference() from public, anon, authenticated;
revoke execute on function public.purchase_requests_record_history() from public, anon, authenticated;
revoke execute on function public.shipment_requests_record_history() from public, anon, authenticated;
revoke execute on function public.disputes_record_history() from public, anon, authenticated;

-- Starting point for reservations that already exist: their current state,
-- since nothing recorded the changes before today.
insert into public.transaction_status_history (purchase_request_id, stage, from_stage, changed_by, note)
select pr.id, 'reservation.' || pr.status, null, null,
       'Current state when history began; earlier changes were not recorded.'
from public.purchase_requests pr
where not exists (select 1 from public.transaction_status_history h where h.purchase_request_id = pr.id);
