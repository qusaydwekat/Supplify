create table public.products (
  id uuid default uuid_generate_v4() primary key,
  supplier_id uuid references public.suppliers(id) on delete cascade not null,
  name text not null,
  description text,
  category text,
  image_url text,
  has_variations boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.product_variations (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  name text not null,
  sku text unique,
  price numeric(10,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  min_order_quantity integer not null default 1 check (min_order_quantity >= 1),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_products_supplier_id on public.products(supplier_id);
create index idx_product_variations_product_id on public.product_variations(product_id);

-- RLS
alter table public.products enable row level security;
alter table public.product_variations enable row level security;

create policy "Products viewable by authenticated users" on public.products for select to authenticated using (true);
create policy "Suppliers can manage own products" on public.products for all using (
  exists (select 1 from public.suppliers where suppliers.id = products.supplier_id and suppliers.user_id = auth.uid())
);

create policy "Product variations viewable by authenticated users" on public.product_variations for select to authenticated using (true);
create policy "Suppliers can manage own product variations" on public.product_variations for all using (
  exists (
    select 1 from public.products p
    join public.suppliers s on s.id = p.supplier_id
    where p.id = product_variations.product_id and s.user_id = auth.uid()
  )
);

