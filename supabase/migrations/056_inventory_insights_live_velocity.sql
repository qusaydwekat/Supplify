-- Inventory insights: compute 30d velocity live from inventory_movements (MV cron may lag).

drop function if exists public.supplier_inventory_insights_paged(integer, integer);

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
      greatest(coalesce(pv.min_order_quantity, 1) * 2, 1)::integer as low_thresh
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
      ) as reorder_flag,
      (v.stk <= v.low_thresh::numeric) as low_flag
    from vars v
  ),
  stats as (
    select
      round(coalesce(sum(vline), 0)::numeric, 2) as tv,
      count(*) filter (where reorder_flag)::bigint as rfc,
      count(*) filter (where low_flag)::bigint as lsc,
      count(*)::bigint as tc_all
    from calc
  ),
  filtered as (
    select c.*, st.tv, st.rfc, st.lsc, st.tc_all
    from calc c
    cross join stats st
    where case coalesce(nullif(trim(lower(p_filter)), ''), 'all')
      when 'reorder' then c.reorder_flag
      when 'low_stock' then c.low_flag
      when 'no_sales' then c.sold30 <= 0 and c.stk > 0
      when 'active' then c.active_sku
      else true
    end
  ),
  numbered as (
    select
      f.*,
      count(*) over ()::bigint as tc,
      row_number() over (order by f.sold30 desc nulls last, lower(f.pnm) asc nulls last, f.vid)::bigint as rn
    from filtered f
  )
  select
    n.vid as variation_id,
    n.pid as product_id,
    n.pnm as product_name,
    n.vlbl as variation_label,
    n.stk as stock,
    n.cp as cost_price,
    n.moq as min_order_quantity,
    n.sold30 as units_sold_30d,
    n.last_sale as last_sale_at,
    round(n.vline::numeric * 100::numeric) / 100::numeric as valuation_line,
    round(n.dv::numeric * 1000::numeric) / 1000::numeric as daily_velocity,
    n.cov as cover_days,
    n.reorder_flag as is_reorder_candidate,
    n.low_flag as is_low_stock,
    n.active_sku as is_active_sku,
    n.tv as total_valuation_snapshot,
    n.rfc as reorder_flagged_count,
    n.lsc as low_stock_count,
    n.tc as total_count
  from numbered n
  where n.rn > greatest(coalesce(p_offset, 0), 0)::bigint
    and n.rn
      <= greatest(coalesce(p_offset, 0), 0)::bigint + least(greatest(coalesce(p_limit, 20), 1), 100)::bigint
  order by n.rn;
$$;

grant execute on function public.supplier_inventory_insights_paged(integer, integer, text) to authenticated;
