create type payment_method as enum ('cash', 'bank', 'cheque', 'other');

create table public.payments (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices(id) not null,
  amount numeric(10,2) not null check (amount > 0),
  method payment_method default 'cash' not null,
  reference_note text,
  created_at timestamptz default now(),
  created_by uuid references public.users(id) not null
);

-- Indexes
create index idx_payments_invoice_id on public.payments(invoice_id);

-- RLS
alter table public.payments enable row level security;

create policy "Payment participants can view" on public.payments for select using (
  exists (
    select 1 from public.invoices i
    where i.id = payments.invoice_id
    and (i.retailer_id = auth.uid() or exists (
      select 1 from public.suppliers s where s.id = i.supplier_id and s.user_id = auth.uid()
    ))
  )
);
create policy "Suppliers can record payments" on public.payments for insert with check (
  auth.uid() = created_by and exists (
    select 1 from public.invoices i
    join public.suppliers s on s.id = i.supplier_id
    where i.id = payments.invoice_id and s.user_id = auth.uid()
  )
);

