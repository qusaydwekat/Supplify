-- Phase 3: product gallery, catalog_status in list RPCs, catalog filter.

-- ---------------------------------------------------------------------------
-- Product image gallery (primary cover remains products.image_url)
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  storage_path text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product_sort
  on public.product_images (product_id, sort_order, created_at);

alter table public.product_images enable row level security;

drop policy if exists "Product images viewable by authenticated" on public.product_images;
create policy "Product images viewable by authenticated"
  on public.product_images for select to authenticated using (true);

drop policy if exists "Suppliers manage own product images" on public.product_images;
create policy "Suppliers manage own product images"
  on public.product_images for all using (
    exists (
      select 1
      from public.products p
      join public.suppliers s on s.id = p.supplier_id
      where p.id = product_images.product_id and s.user_id = auth.uid()
    )
  );

insert into public.product_images (product_id, url, storage_path, sort_order)
select p.id, p.image_url, 'legacy/' || p.id::text, 0
from public.products p
where p.image_url is not null
  and trim(p.image_url) <> ''
  and not exists (
    select 1 from public.product_images pi where pi.product_id = p.id and pi.url = p.image_url
  );

-- ---------------------------------------------------------------------------
-- List stats with optional catalog_status filter
-- ---------------------------------------------------------------------------
drop function if exists public.supplier_product_list_stats(text, text, text, boolean);

create or replace function public.supplier_product_list_stats(
  p_search text default null,
  p_marketplace_category text default null,
  p_status text default 'all',
  p_low_stock_only boolean default false,
  p_catalog_status text default null
)
returns table (
  total_products bigint,
  active_products bigint,
  low_stock_products bigint,
  draft_products bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      p.id,
      p.is_active,
      p.catalog_status,
      exists (
        select 1
        from public.product_variations pv
        where pv.product_id = p.id
          and coalesce(pv.is_active, true)
          and coalesce(pv.stock_quantity, 0)
            <= public.variation_low_stock_threshold(pv.min_order_quantity, pv.reorder_point)
      ) as is_low_stock
    from public.products p
    inner join public.suppliers s on s.id = p.supplier_id and s.user_id = auth.uid()
    where (
      p_search is null
      or trim(p_search) = ''
      or p.name ilike '%' || trim(p_search) || '%'
    )
    and (
      p_marketplace_category is null
      or trim(p_marketplace_category) = ''
      or p.marketplace_category::text = trim(p_marketplace_category)
    )
    and (
      p_status is null
      or p_status = 'all'
      or (p_status = 'active' and coalesce(p.is_active, true))
      or (p_status = 'inactive' and not coalesce(p.is_active, true))
    )
    and (
      p_catalog_status is null
      or trim(p_catalog_status) = ''
      or p.catalog_status::text = trim(p_catalog_status)
    )
  )
  select
    count(*)::bigint as total_products,
    count(*) filter (where is_active)::bigint as active_products,
    count(*) filter (where is_low_stock)::bigint as low_stock_products,
    count(*) filter (where catalog_status = 'draft'::public.product_catalog_status)::bigint as draft_products
  from scoped
  where not p_low_stock_only or is_low_stock;
$$;

grant execute on function public.supplier_product_list_stats(text, text, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Paged list with catalog_status column + filter
-- ---------------------------------------------------------------------------
drop function if exists public.supplier_products_paged(integer, integer, text, text, text, boolean, text);

create or replace function public.supplier_products_paged(
  p_limit integer default 20,
  p_offset integer default 0,
  p_search text default null,
  p_marketplace_category text default null,
  p_status text default 'all',
  p_low_stock_only boolean default false,
  p_sort text default 'updated_desc',
  p_catalog_status text default null
)
returns table (
  id uuid,
  name text,
  category text,
  marketplace_category public.supplier_marketplace_category,
  catalog_status public.product_catalog_status,
  is_active boolean,
  has_variations boolean,
  updated_at timestamptz,
  variation_count integer,
  min_stock integer,
  has_low_stock boolean,
  image_url text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      p.id,
      p.name,
      p.category,
      p.marketplace_category,
      p.catalog_status,
      coalesce(p.is_active, true) as is_active,
      coalesce(p.has_variations, false) as has_variations,
      p.updated_at,
      p.image_url,
      count(pv.id)::integer as variation_count,
      coalesce(min(pv.stock_quantity), 0)::integer as min_stock,
      bool_or(
        coalesce(pv.is_active, true)
        and coalesce(pv.stock_quantity, 0)
          <= public.variation_low_stock_threshold(pv.min_order_quantity, pv.reorder_point)
      ) as has_low_stock
    from public.products p
    inner join public.suppliers s on s.id = p.supplier_id and s.user_id = auth.uid()
    left join public.product_variations pv on pv.product_id = p.id
    where (
      p_search is null
      or trim(p_search) = ''
      or p.name ilike '%' || trim(p_search) || '%'
    )
    and (
      p_marketplace_category is null
      or trim(p_marketplace_category) = ''
      or p.marketplace_category::text = trim(p_marketplace_category)
    )
    and (
      p_status is null
      or p_status = 'all'
      or (p_status = 'active' and coalesce(p.is_active, true))
      or (p_status = 'inactive' and not coalesce(p.is_active, true))
    )
    and (
      p_catalog_status is null
      or trim(p_catalog_status) = ''
      or p.catalog_status::text = trim(p_catalog_status)
    )
    group by
      p.id, p.name, p.category, p.marketplace_category, p.catalog_status,
      p.is_active, p.has_variations, p.updated_at, p.image_url
  ),
  filtered as (
    select *
    from base
    where not p_low_stock_only or has_low_stock
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  )
  select
    f.id,
    f.name,
    f.category,
    f.marketplace_category,
    f.catalog_status,
    f.is_active,
    f.has_variations,
    f.updated_at,
    f.variation_count,
    f.min_stock,
    f.has_low_stock,
    f.image_url,
    c.cnt as total_count
  from filtered f
  cross join counted c
  order by
    case when p_sort = 'name_asc' then f.name end asc nulls last,
    case when p_sort = 'name_desc' then f.name end desc nulls last,
    case when p_sort = 'stock_asc' then f.min_stock end asc nulls last,
    case when p_sort = 'updated_desc' then f.updated_at end desc nulls last,
    f.updated_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.supplier_products_paged(integer, integer, text, text, text, boolean, text, text) to authenticated;
