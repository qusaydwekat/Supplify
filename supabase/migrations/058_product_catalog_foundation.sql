-- Phase 1 product catalog foundation: reorder fields, marketplace category, list RPCs, unified low-stock.

-- ---------------------------------------------------------------------------
-- Product catalog status (Phase 3 UI will use; backfill from is_active)
-- ---------------------------------------------------------------------------
do $e$
begin
  create type public.product_catalog_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $e$;

alter table public.products
  add column if not exists catalog_status public.product_catalog_status not null default 'published';

alter table public.products
  add column if not exists marketplace_category public.supplier_marketplace_category;

comment on column public.products.marketplace_category is
  'Product-level marketplace category for supplier catalog (replaces free-text category over time).';
comment on column public.products.catalog_status is
  'Catalog workflow status; is_active remains for backward compatibility with retailer browse.';

update public.products
set catalog_status = 'archived'::public.product_catalog_status
where coalesce(is_active, true) = false
  and catalog_status = 'published'::public.product_catalog_status;

-- Best-effort map legacy text category to enum
update public.products p
set marketplace_category = 'general_merchandise'::public.supplier_marketplace_category
where p.marketplace_category is null
  and p.category is not null
  and trim(p.category) <> '';

create index if not exists idx_products_supplier_catalog
  on public.products (supplier_id, catalog_status, updated_at desc);

create index if not exists idx_products_marketplace_category
  on public.products (supplier_id, marketplace_category)
  where marketplace_category is not null;

-- ---------------------------------------------------------------------------
-- Variation reorder settings
-- ---------------------------------------------------------------------------
alter table public.product_variations
  add column if not exists reorder_point integer
    check (reorder_point is null or reorder_point >= 0);

alter table public.product_variations
  add column if not exists reorder_qty integer
    check (reorder_qty is null or reorder_qty >= 1);

alter table public.product_variations
  add column if not exists lead_time_days integer
    check (lead_time_days is null or lead_time_days >= 0);

update public.product_variations
set reorder_point = greatest(coalesce(min_order_quantity, 1) * 2, 1)
where reorder_point is null;

comment on column public.product_variations.reorder_point is
  'Stock level at or below which SKU is considered low stock (notifications, filters, insights).';

-- ---------------------------------------------------------------------------
-- Unified low-stock threshold helper
-- ---------------------------------------------------------------------------
create or replace function public.variation_low_stock_threshold(p_min_order_qty integer, p_reorder_point integer)
returns integer
language sql
immutable
as $$
  select coalesce(
    p_reorder_point,
    greatest(coalesce(p_min_order_qty, 1) * 2, 1)
  )::integer;
$$;

-- ---------------------------------------------------------------------------
-- Low-stock notification uses reorder_point
-- ---------------------------------------------------------------------------
create or replace function public.notify_low_stock_on_variation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold int;
  v_supplier_user_id uuid;
  v_product_name text;
begin
  v_threshold := public.variation_low_stock_threshold(NEW.min_order_quantity, NEW.reorder_point);

  if NEW.stock_quantity > v_threshold then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.stock_quantity <= public.variation_low_stock_threshold(OLD.min_order_quantity, OLD.reorder_point) then
      return NEW;
    end if;
  end if;

  select s.user_id, p.name
  into v_supplier_user_id, v_product_name
  from public.products p
  join public.suppliers s on s.id = p.supplier_id
  where p.id = NEW.product_id;

  if v_supplier_user_id is null then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, title, message, title_key, message_key, params, reference_id, reference_type)
  values (
    v_supplier_user_id,
    'low_stock',
    'Low stock',
    format('"%s" is running low (%s units left).', coalesce(v_product_name, 'Product'), NEW.stock_quantity),
    'lowStock.title',
    'lowStock.message',
    jsonb_build_object(
      'product', coalesce(v_product_name, 'Product'),
      'variation', NEW.name,
      'stock', NEW.stock_quantity,
      'threshold', v_threshold
    ),
    NEW.product_id,
    'product'
  );

  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- Supplier product list stats (full filter set, not page-limited)
-- ---------------------------------------------------------------------------
create or replace function public.supplier_product_list_stats(
  p_search text default null,
  p_marketplace_category text default null,
  p_status text default 'all',
  p_low_stock_only boolean default false
)
returns table (
  total_products bigint,
  active_products bigint,
  low_stock_products bigint
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
  )
  select
    count(*)::bigint as total_products,
    count(*) filter (where is_active)::bigint as active_products,
    count(*) filter (where is_low_stock)::bigint as low_stock_products
  from scoped
  where not p_low_stock_only or is_low_stock;
$$;

grant execute on function public.supplier_product_list_stats(text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Paged supplier product list
-- ---------------------------------------------------------------------------
create or replace function public.supplier_products_paged(
  p_limit integer default 20,
  p_offset integer default 0,
  p_search text default null,
  p_marketplace_category text default null,
  p_status text default 'all',
  p_low_stock_only boolean default false,
  p_sort text default 'updated_desc'
)
returns table (
  id uuid,
  name text,
  category text,
  marketplace_category public.supplier_marketplace_category,
  is_active boolean,
  has_variations boolean,
  updated_at timestamptz,
  variation_count integer,
  min_stock integer,
  has_low_stock boolean,
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
      coalesce(p.is_active, true) as is_active,
      coalesce(p.has_variations, false) as has_variations,
      p.updated_at,
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
    group by p.id, p.name, p.category, p.marketplace_category, p.is_active, p.has_variations, p.updated_at
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
    f.is_active,
    f.has_variations,
    f.updated_at,
    f.variation_count,
    f.min_stock,
    f.has_low_stock,
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

grant execute on function public.supplier_products_paged(integer, integer, text, text, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Variation movement history (audit trail)
-- ---------------------------------------------------------------------------
create or replace function public.supplier_variation_movements_paged(
  p_variation_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  movement_type public.inventory_movement_type,
  quantity integer,
  adjustment_increase boolean,
  reference_type text,
  notes text,
  created_at timestamptz,
  stock_after integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select m.*
    from public.inventory_movements m
    inner join public.product_variations pv on pv.id = m.product_variation_id
    inner join public.products p on p.id = pv.product_id
    inner join public.suppliers s on s.id = p.supplier_id and s.user_id = auth.uid()
    where m.product_variation_id = p_variation_id
  ),
  numbered as (
    select
      s.*,
      sum(
        case s.type
          when 'purchase'::public.inventory_movement_type then s.quantity
          when 'return'::public.inventory_movement_type then s.quantity
          when 'sale'::public.inventory_movement_type then -s.quantity
          when 'damage'::public.inventory_movement_type then -s.quantity
          when 'adjustment'::public.inventory_movement_type then
            case when s.adjustment_increase then s.quantity else -s.quantity end
          else 0
        end
      ) over (
        order by s.created_at asc, s.id asc
        rows between unbounded preceding and current row
      )::integer as running_stock
    from scoped s
  ),
  counted as (
    select count(*)::bigint as cnt from numbered
  )
  select
    n.id,
    n.type as movement_type,
    n.quantity,
    n.adjustment_increase,
    n.reference_type,
    n.notes,
    n.created_at,
    n.running_stock as stock_after,
    c.cnt as total_count
  from numbered n
  cross join counted c
  order by n.created_at desc, n.id desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.supplier_variation_movements_paged(uuid, integer, integer) to authenticated;

-- Refresh inventory insights low-stock to honor reorder_point
drop function if exists public.supplier_inventory_insights_paged(integer, integer, text);

create or replace function public.supplier_inventory_insights_paged(
  p_limit integer default 20,
  p_offset integer default 0,
  p_filter text default 'all'
)
returns table (
  variation_id uuid,
  product_id uuid,
  product_name text,
  variation_label text,
  stock numeric,
  cost_price numeric,
  min_order_quantity integer,
  units_sold_30d numeric,
  last_sale_at timestamptz,
  valuation_line numeric,
  daily_velocity numeric,
  cover_days numeric,
  is_reorder_candidate boolean,
  is_low_stock boolean,
  is_active_sku boolean,
  total_valuation_snapshot numeric,
  reorder_flagged_count bigint,
  low_stock_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with velocity as (
    select
      m.supplier_id,
      m.product_variation_id,
      sum(m.quantity)::numeric as units_sold_30d,
      max(m.created_at) as last_sale_at
    from public.inventory_movements m
    inner join public.suppliers s on s.id = m.supplier_id and s.user_id = auth.uid()
    where m.type = 'sale'::public.inventory_movement_type
      and m.created_at >= timezone('utc', now()) - interval '30 days'
    group by m.supplier_id, m.product_variation_id
  ),
  vars as (
    select
      pv.id as vid,
      p.id as pid,
      pv.name::text as vlbl,
      coalesce(pv.stock_quantity, 0)::numeric as stk,
      coalesce(pv.cost_price, 0)::numeric as cp,
      coalesce(pv.min_order_quantity, 1)::integer as moq,
      p.name::text as pnm,
      coalesce(vel.units_sold_30d, 0)::numeric as sold30,
      vel.last_sale_at::timestamptz as last_sale,
      greatest(coalesce(pv.stock_quantity, 0)::numeric * coalesce(pv.cost_price, 0)::numeric, 0)::numeric as vline,
      greatest(coalesce(vel.units_sold_30d, 0)::numeric / 30::numeric, 0) as dv,
      (p.is_active and coalesce(pv.is_active, true)) as active_sku,
      public.variation_low_stock_threshold(pv.min_order_quantity, pv.reorder_point)::integer as low_thresh
    from public.product_variations pv
    inner join public.products p on p.id = pv.product_id
    inner join public.suppliers s on s.id = p.supplier_id
    left join velocity vel on vel.product_variation_id = pv.id and vel.supplier_id = s.id
    where s.user_id = auth.uid()
  ),
  calc as (
    select
      v.*,
      case
        when v.dv > 0.001 then round((v.stk / v.dv) * 10::numeric) / 10::numeric
        else null::numeric
      end as cov,
      (
        v.stk > 0
        and v.sold30 >= 3
        and v.dv > 0.001
        and round((v.stk / v.dv) * 10::numeric) / 10::numeric < 14::numeric
      ) as reorder_cand,
      (v.stk <= v.low_thresh) as low_stk
    from vars v
  ),
  filtered as (
    select *
    from calc
    where
      p_filter = 'all'
      or (p_filter = 'reorder' and reorder_cand)
      or (p_filter = 'low_stock' and low_stk)
      or (p_filter = 'active' and active_sku)
  ),
  snap as (
    select
      coalesce(sum(vline) filter (where active_sku), 0)::numeric as total_val,
      count(*) filter (where reorder_cand and active_sku)::bigint as reorder_cnt,
      count(*) filter (where low_stk and active_sku)::bigint as low_cnt,
      count(*)::bigint as all_cnt
    from calc
  )
  select
    f.vid as variation_id,
    f.pid as product_id,
    f.pnm as product_name,
    f.vlbl as variation_label,
    f.stk as stock,
    f.cp as cost_price,
    f.moq as min_order_quantity,
    f.sold30 as units_sold_30d,
    f.last_sale as last_sale_at,
    f.vline as valuation_line,
    f.dv as daily_velocity,
    f.cov as cover_days,
    f.reorder_cand as is_reorder_candidate,
    f.low_stk as is_low_stock,
    f.active_sku as is_active_sku,
    s.total_val as total_valuation_snapshot,
    s.reorder_cnt as reorder_flagged_count,
    s.low_cnt as low_stock_count,
    s.all_cnt as total_count
  from filtered f
  cross join snap s
  order by f.low_stk desc, f.reorder_cand desc, f.pnm asc, f.vlbl asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.supplier_inventory_insights_paged(integer, integer, text) to authenticated;
