-- West Bank market features:
--   * Tax IDs and commercial registration on profiles
--   * Hijri opt-in display preference
--   * Cheque cycle states (post-dated cheque lifecycle)
--   * Withholding tax (خصم المصدر) on payments
--   * Cash-on-delivery (COD) flag on orders
--   * Retailer-initiated bank deposit proofs (supplier confirms)
--   * Supplier multi-bank accounts (IBAN list)

-- ---------------------------------------------------------------------------
-- Profiles: tax / commercial registration + Hijri preference
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists tax_id text,
  add column if not exists commercial_registration text,
  add column if not exists vat_registered boolean not null default false,
  add column if not exists prefer_hijri boolean not null default false;

comment on column public.profiles.tax_id is 'PA Ministry of Finance tax ID ("رقم المكلف"). Required for VAT-registered businesses on tax invoices.';
comment on column public.profiles.commercial_registration is 'Ministry of National Economy commercial registration number.';
comment on column public.profiles.vat_registered is 'When true, the business issues / receives tax invoices and shows tax IDs on documents.';
comment on column public.profiles.prefer_hijri is 'When true, render Hijri dates alongside Gregorian on documents and lists.';

-- ---------------------------------------------------------------------------
-- Cheque cycle on payments
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cheque_status') then
    create type public.cheque_status as enum (
      'pending_due', 'deposited', 'cleared', 'bounced', 'replaced'
    );
  end if;
end $$;

alter table public.payments
  add column if not exists cheque_status public.cheque_status,
  add column if not exists cheque_cleared_at timestamptz,
  add column if not exists cheque_bounced_at timestamptz,
  add column if not exists cheque_bounce_reason text,
  add column if not exists cheque_replaced_by_payment_id uuid references public.payments(id);

create index if not exists idx_payments_cheque_status_date
  on public.payments (cheque_status, cheque_date)
  where cheque_status is not null;

-- Default cheque payments to pending_due if cheque metadata exists.
update public.payments
set cheque_status = 'pending_due'::public.cheque_status
where method = 'cheque' and cheque_status is null;

-- ---------------------------------------------------------------------------
-- Withholding tax on payments
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists withholding_amount numeric(10,2) default 0 check (withholding_amount >= 0),
  add column if not exists withholding_reference text;

comment on column public.payments.withholding_amount is 'Amount withheld by the buyer for tax authority remittance ("خصم المصدر"), in invoice currency.';
comment on column public.payments.withholding_reference is 'Withholding certificate number issued by the buyer.';

-- ---------------------------------------------------------------------------
-- Cash-on-delivery flag on orders
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists is_cod boolean not null default false;

comment on column public.orders.is_cod is 'When true, the retailer pays in cash on delivery; supplier records collection at delivery time.';

-- ---------------------------------------------------------------------------
-- Retailer-submitted bank deposit proofs (supplier confirms → real payment)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'deposit_proof_status') then
    create type public.deposit_proof_status as enum ('pending', 'confirmed', 'rejected');
  end if;
end $$;

create table if not exists public.payment_deposit_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  retailer_id uuid not null references public.users(id),
  amount numeric(10,2) not null check (amount > 0),
  payment_currency text not null,
  bank_name text,
  branch text,
  reference_note text,
  deposit_date date,
  attachment_path text,
  attachment_name text,
  status public.deposit_proof_status not null default 'pending',
  payment_id uuid references public.payments(id),
  reject_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id)
);

create index if not exists idx_pdp_supplier_status on public.payment_deposit_proofs (supplier_id, status, created_at desc);
create index if not exists idx_pdp_invoice on public.payment_deposit_proofs (invoice_id);

alter table public.payment_deposit_proofs enable row level security;

create policy "deposit_proof_participants_select"
  on public.payment_deposit_proofs for select using (
    auth.uid() = retailer_id
    or exists (
      select 1 from public.suppliers s
      where s.id = payment_deposit_proofs.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "deposit_proof_retailer_insert"
  on public.payment_deposit_proofs for insert with check (
    auth.uid() = retailer_id
    and exists (
      select 1 from public.invoices i
      where i.id = payment_deposit_proofs.invoice_id
        and i.retailer_id = auth.uid()
        and i.supplier_id = payment_deposit_proofs.supplier_id
    )
  );

create policy "deposit_proof_supplier_update"
  on public.payment_deposit_proofs for update using (
    exists (
      select 1 from public.suppliers s
      where s.id = payment_deposit_proofs.supplier_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Supplier multi-bank accounts (IBAN list shown on invoices)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  bank_name text not null,
  branch text,
  account_holder text not null,
  iban text,
  account_number text,
  swift text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_bank_accounts_supplier
  on public.supplier_bank_accounts (supplier_id, is_active);

alter table public.supplier_bank_accounts enable row level security;

create policy "sba_authenticated_read"
  on public.supplier_bank_accounts for select to authenticated using (true);

create policy "sba_supplier_manage"
  on public.supplier_bank_accounts for all using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_bank_accounts.supplier_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_bank_accounts.supplier_id and s.user_id = auth.uid()
    )
  );

-- Only one default per supplier (partial unique index).
create unique index if not exists idx_sba_one_default_per_supplier
  on public.supplier_bank_accounts (supplier_id)
  where is_default = true;
