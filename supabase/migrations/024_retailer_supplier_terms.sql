-- Phase 1: per-pair credit limit, payment terms metadata, grace days, blocked flag

create table public.retailer_supplier_terms (
  id uuid default gen_random_uuid() primary key,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  retailer_id uuid not null references public.users (id) on delete cascade,
  credit_limit numeric(12, 2) null check (credit_limit is null or credit_limit >= 0),
  payment_terms_days int not null default 30 check (payment_terms_days >= 1 and payment_terms_days <= 365),
  grace_days int not null default 0 check (grace_days >= 0 and grace_days <= 90),
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, retailer_id)
);

create index idx_rst_supplier on public.retailer_supplier_terms (supplier_id);
create index idx_rst_retailer on public.retailer_supplier_terms (retailer_id);

comment on table public.retailer_supplier_terms is
  'Trade terms between a supplier and a retailer. credit_limit null = no limit enforced. Exposure = ledger balance + uninvoiced active orders + candidate order total.';

alter table public.retailer_supplier_terms enable row level security;

create policy "Suppliers manage own trade terms"
  on public.retailer_supplier_terms
  for all
  using (
    exists (
      select 1
      from public.suppliers s
      where s.id = retailer_supplier_terms.supplier_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.suppliers s
      where s.id = retailer_supplier_terms.supplier_id
        and s.user_id = auth.uid()
    )
  );

create policy "Retailers read own trade terms"
  on public.retailer_supplier_terms
  for select
  using (auth.uid() = retailer_id);
