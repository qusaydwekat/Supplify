create type order_status as enum (
  'pending', 'accepted', 'modified', 'rejected',
  'preparing', 'shipped', 'delivered', 'cancelled'
);

create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  retailer_id uuid references public.users(id) not null,
  supplier_id uuid references public.suppliers(id) not null,
  status order_status default 'pending' not null,
  total_price numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  variation_id uuid references public.product_variations(id),
  product_name text not null,
  variation_name text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total_price numeric(10,2) generated always as (quantity * unit_price) stored
);

-- Indexes
create index idx_orders_retailer_id on public.orders(retailer_id);
create index idx_orders_supplier_id on public.orders(supplier_id);
create index idx_orders_status on public.orders(status);
create index idx_order_items_order_id on public.order_items(order_id);

-- RLS
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Retailers see own orders" on public.orders for select using (auth.uid() = retailer_id);
create policy "Suppliers see orders for their store" on public.orders for select using (
  exists (select 1 from public.suppliers where suppliers.id = orders.supplier_id and suppliers.user_id = auth.uid())
);
create policy "Retailers can create orders" on public.orders for insert with check (auth.uid() = retailer_id);
create policy "Retailers can update own pending orders" on public.orders for update using (auth.uid() = retailer_id and status = 'pending');
create policy "Suppliers can update order status" on public.orders for update using (
  exists (select 1 from public.suppliers where suppliers.id = orders.supplier_id and suppliers.user_id = auth.uid())
);

create policy "Order items viewable by order participants" on public.order_items for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
    and (o.retailer_id = auth.uid() or exists (
      select 1 from public.suppliers s where s.id = o.supplier_id and s.user_id = auth.uid()
    ))
  )
);
create policy "Order items insertable by retailers" on public.order_items for insert with check (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.retailer_id = auth.uid())
);

