create type ledger_entry_type as enum ('invoice', 'payment');

create table public.ledger_entries (
  id uuid default uuid_generate_v4() primary key,
  supplier_id uuid references public.suppliers(id) not null,
  retailer_id uuid references public.users(id) not null,
  type ledger_entry_type not null,
  amount numeric(10,2) not null,
  -- IMPORTANT: positive for invoices, negative for payments
  reference_id uuid not null,
  description text,
  created_at timestamptz default now()
);

-- Indexes for fast balance queries
create index idx_ledger_supplier_retailer on public.ledger_entries(supplier_id, retailer_id);
create index idx_ledger_supplier on public.ledger_entries(supplier_id);
create index idx_ledger_retailer on public.ledger_entries(retailer_id);
create index idx_ledger_created_at on public.ledger_entries(created_at);

-- Prevent UPDATE and DELETE — ledger is append-only
create rule no_update_ledger as on update to public.ledger_entries do instead nothing;
create rule no_delete_ledger as on delete to public.ledger_entries do instead nothing;

-- RLS
alter table public.ledger_entries enable row level security;

create policy "Suppliers can view own ledger" on public.ledger_entries for select using (
  exists (select 1 from public.suppliers where suppliers.id = ledger_entries.supplier_id and suppliers.user_id = auth.uid())
);
create policy "Retailers can view own ledger entries" on public.ledger_entries for select using (auth.uid() = retailer_id);
create policy "Suppliers can insert ledger entries" on public.ledger_entries for insert with check (
  exists (select 1 from public.suppliers where suppliers.id = ledger_entries.supplier_id and suppliers.user_id = auth.uid())
);

