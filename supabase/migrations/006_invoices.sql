create type invoice_type as enum ('proforma', 'final');
create type invoice_status as enum ('issued', 'paid', 'partial', 'overdue');

create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) not null,
  invoice_number text not null unique,
  type invoice_type default 'final' not null,
  status invoice_status default 'issued' not null,
  total numeric(10,2) not null,
  issued_at timestamptz default now(),
  due_date timestamptz,
  paid_at timestamptz,
  notes text,
  supplier_id uuid references public.suppliers(id) not null,
  retailer_id uuid references public.users(id) not null
);

create table public.invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  product_name text not null,
  variation_name text,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) generated always as (quantity * unit_price) stored
);

-- Auto-generate invoice numbers
create sequence invoice_number_seq start 1000;

create or replace function generate_invoice_number()
returns trigger as $$
begin
  new.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_invoice_number
  before insert on public.invoices
  for each row
  when (new.invoice_number is null or new.invoice_number = '')
  execute function generate_invoice_number();

-- Indexes
create index idx_invoices_supplier_id on public.invoices(supplier_id);
create index idx_invoices_retailer_id on public.invoices(retailer_id);
create index idx_invoices_status on public.invoices(status);

-- RLS
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "Retailers can view own invoices" on public.invoices for select using (auth.uid() = retailer_id);
create policy "Suppliers can view and manage invoices" on public.invoices for all using (
  exists (select 1 from public.suppliers where suppliers.id = invoices.supplier_id and suppliers.user_id = auth.uid())
);

create policy "Invoice items viewable by invoice participants" on public.invoice_items for select using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_items.invoice_id
    and (i.retailer_id = auth.uid() or exists (
      select 1 from public.suppliers s where s.id = i.supplier_id and s.user_id = auth.uid()
    ))
  )
);
create policy "Suppliers can manage invoice items" on public.invoice_items for all using (
  exists (
    select 1 from public.invoices i
    join public.suppliers s on s.id = i.supplier_id
    where i.id = invoice_items.invoice_id and s.user_id = auth.uid()
  )
);

