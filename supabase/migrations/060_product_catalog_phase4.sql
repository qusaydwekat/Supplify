-- Phase 4: attribute matrix + volume price tiers + resolver for cart/orders.

-- ---------------------------------------------------------------------------
-- Product attributes (e.g. Size, Color)
-- ---------------------------------------------------------------------------
create table if not exists public.product_attributes (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, name)
);

create table if not exists public.product_attribute_options (
  id uuid primary key default uuid_generate_v4(),
  attribute_id uuid not null references public.product_attributes(id) on delete cascade,
  value text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (attribute_id, value)
);

create table if not exists public.variation_attribute_options (
  variation_id uuid not null references public.product_variations(id) on delete cascade,
  option_id uuid not null references public.product_attribute_options(id) on delete cascade,
  primary key (variation_id, option_id)
);

create index if not exists idx_product_attributes_product
  on public.product_attributes (product_id, sort_order);

create index if not exists idx_attribute_options_attribute
  on public.product_attribute_options (attribute_id, sort_order);

create index if not exists idx_variation_attribute_options_option
  on public.variation_attribute_options (option_id);

-- ---------------------------------------------------------------------------
-- Volume price tiers per SKU
-- ---------------------------------------------------------------------------
create table if not exists public.variation_price_tiers (
  id uuid primary key default uuid_generate_v4(),
  variation_id uuid not null references public.product_variations(id) on delete cascade,
  min_quantity integer not null check (min_quantity >= 1),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (variation_id, min_quantity)
);

create index if not exists idx_variation_price_tiers_variation
  on public.variation_price_tiers (variation_id, min_quantity);

-- ---------------------------------------------------------------------------
-- Resolve unit price for a quantity (tiers override base price)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_variation_unit_price(
  p_variation_id uuid,
  p_quantity integer
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select t.unit_price
      from public.variation_price_tiers t
      where t.variation_id = p_variation_id
        and t.min_quantity <= greatest(coalesce(p_quantity, 1), 1)
      order by t.min_quantity desc
      limit 1
    ),
    (
      select pv.price
      from public.product_variations pv
      where pv.id = p_variation_id
    ),
    0::numeric
  );
$$;

grant execute on function public.resolve_variation_unit_price(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.product_attributes enable row level security;
alter table public.product_attribute_options enable row level security;
alter table public.variation_attribute_options enable row level security;
alter table public.variation_price_tiers enable row level security;

drop policy if exists "Product attributes readable" on public.product_attributes;
create policy "Product attributes readable"
  on public.product_attributes for select to authenticated using (true);

drop policy if exists "Suppliers manage product attributes" on public.product_attributes;
create policy "Suppliers manage product attributes"
  on public.product_attributes for all using (
    exists (
      select 1 from public.products p
      join public.suppliers s on s.id = p.supplier_id
      where p.id = product_attributes.product_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Attribute options readable" on public.product_attribute_options;
create policy "Attribute options readable"
  on public.product_attribute_options for select to authenticated using (true);

drop policy if exists "Suppliers manage attribute options" on public.product_attribute_options;
create policy "Suppliers manage attribute options"
  on public.product_attribute_options for all using (
    exists (
      select 1 from public.product_attributes a
      join public.products p on p.id = a.product_id
      join public.suppliers s on s.id = p.supplier_id
      where a.id = product_attribute_options.attribute_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Variation attribute options readable" on public.variation_attribute_options;
create policy "Variation attribute options readable"
  on public.variation_attribute_options for select to authenticated using (true);

drop policy if exists "Suppliers manage variation attribute options" on public.variation_attribute_options;
create policy "Suppliers manage variation attribute options"
  on public.variation_attribute_options for all using (
    exists (
      select 1 from public.product_variations pv
      join public.products p on p.id = pv.product_id
      join public.suppliers s on s.id = p.supplier_id
      where pv.id = variation_attribute_options.variation_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Price tiers readable" on public.variation_price_tiers;
create policy "Price tiers readable"
  on public.variation_price_tiers for select to authenticated using (true);

drop policy if exists "Suppliers manage price tiers" on public.variation_price_tiers;
create policy "Suppliers manage price tiers"
  on public.variation_price_tiers for all using (
    exists (
      select 1 from public.product_variations pv
      join public.products p on p.id = pv.product_id
      join public.suppliers s on s.id = p.supplier_id
      where pv.id = variation_price_tiers.variation_id and s.user_id = auth.uid()
    )
  );
