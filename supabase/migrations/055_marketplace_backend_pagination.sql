-- Server-side LIMIT/OFFSET for marketplace grids and supplier inventory table (migration 054 category enum applies).

create or replace function public.list_marketplace_suppliers_browse(
  p_q text default null,
  p_city text default null,
  p_sort text default 'recommended',
  p_category_slugs text[] default null,
  p_include_uncategorized boolean default false,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  description text,
  delivery_areas text[],
  logo_url text,
  is_active boolean,
  avg_rating numeric,
  review_count integer,
  marketplace_categories public.supplier_marketplace_category[],
  profile_business_name text,
  profile_city text,
  profile_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim int := least(greatest(coalesce(p_limit, 12), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  cat_enums public.supplier_marketplace_category[];
  slug text;
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'recommended');
begin
  cat_enums := '{}';
  if p_category_slugs is not null then
    foreach slug in array p_category_slugs
    loop
      if slug is null or btrim(slug) = '' then continue; end if;
      cat_enums := array_append(cat_enums, (btrim(slug))::public.supplier_marketplace_category);
    end loop;
  end if;

  return query
  with base as (
    select
      s.id as bid,
      s.user_id as buid,
      s.description as bdesc,
      s.delivery_areas as bdel,
      s.logo_url as blogo,
      s.is_active as bactive,
      s.avg_rating as brating,
      s.review_count as brcount,
      s.marketplace_categories as bcats,
      coalesce(nullif(btrim(pr.business_name), ''), nullif(btrim(pr.name), ''), '')::text as pname
    from public.suppliers s
    inner join public.users u on u.id = s.user_id
    inner join public.profiles pr on pr.user_id = s.user_id
    where coalesce(s.is_active, true)
      and u.role = 'supplier'::public.user_role
      and (
        (cardinality(cat_enums) = 0 and not coalesce(p_include_uncategorized, false))
        or (
          coalesce(p_include_uncategorized, false)
          and coalesce(cardinality(s.marketplace_categories), 0) = 0
        )
        or (cardinality(cat_enums) > 0 and s.marketplace_categories && cat_enums)
      )
      and (
        p_city is null
        or btrim(p_city) = ''
        or lower(coalesce(pr.city, '')) like '%' || lower(btrim(p_city)) || '%'
      )
      and (
        p_q is null
        or btrim(p_q) = ''
        or lower(coalesce(nullif(btrim(pr.business_name), ''), nullif(btrim(pr.name), ''), ''))
          like '%' || lower(btrim(p_q)) || '%'
        or lower(coalesce(pr.city, '')) like '%' || lower(btrim(p_q)) || '%'
        or lower(coalesce(s.description, '')) like '%' || lower(btrim(p_q)) || '%'
        or lower(coalesce(array_to_string(s.marketplace_categories::text[], ' '), ''))
          like '%' || lower(btrim(p_q)) || '%'
      )
  ),
  scored as (
    select
      b.*,
      (coalesce(b.brating, 0)::numeric * 10 + coalesce(b.brcount, 0)::numeric * 0.2) as rec_score,
      count(*) over ()::bigint as cnt
    from base b
  ),
  ranked as (
    select
      s.*,
      row_number() over (
        order by
          case when v_sort = 'recommended' then s.rec_score end desc nulls last,
          case when v_sort = 'rating' then s.brating end desc nulls last,
          case when v_sort = 'rating' then s.brcount end desc nulls last,
          case when v_sort = 'name' then lower(s.pname) end asc nulls last,
          s.bid
      )::bigint as rn
    from scored s
  )
  select
    r.bid as id,
    r.buid as user_id,
    r.bdesc as description,
    r.bdel as delivery_areas,
    r.blogo as logo_url,
    r.bactive as is_active,
    r.brating as avg_rating,
    r.brcount as review_count,
    r.bcats as marketplace_categories,
    nullif(btrim(pr.business_name), '')::text as profile_business_name,
    coalesce(pr.city, '')::text as profile_city,
    nullif(btrim(pr.name), '')::text as profile_name,
    r.cnt as total_count
  from ranked r
  inner join public.profiles pr on pr.user_id = r.buid
  where r.rn > off
    and r.rn <= off + lim
  order by r.rn;
end;
$$;

grant execute on function public.list_marketplace_suppliers_browse(
  text, text, text, text[], boolean, integer, integer
) to authenticated;

create or replace function public.search_marketplace_products_paged(
  p_q text,
  p_sort text default 'recommended',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  description text,
  category text,
  image_url text,
  supplier_id uuid,
  variation_min_price numeric,
  supplier_currency text,
  supplier_user_id uuid,
  profile_business_name text,
  profile_city text,
  profile_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim int := least(greatest(coalesce(p_limit, 12), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  needle text := lower(trim(coalesce(p_q, '')));
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'recommended');
begin
  return query
  with cand as (
    select
      prd.id as cid,
      prd.supplier_id as csup,
      lower(prd.name::text) as lname,
      coalesce(lower(prd.description::text), '') as ldesc,
      coalesce(lower(prd.category::text), '') as lcat
    from public.products prd
    inner join public.suppliers s on s.id = prd.supplier_id
    inner join public.users u on u.id = s.user_id
    where prd.is_active
      and coalesce(s.is_active, true)
      and u.role = 'supplier'::public.user_role
      and needle <> ''
      and (
        lower(prd.name::text) like '%' || needle || '%'
        or coalesce(lower(prd.description::text), '') like '%' || needle || '%'
        or coalesce(lower(prd.category::text), '') like '%' || needle || '%'
      )
  ),
  mpp as (
    select pv.product_id as pid, min(pv.price)::numeric as min_price
    from public.product_variations pv
    inner join cand z on z.cid = pv.product_id
    where pv.is_active
    group by pv.product_id
  ),
  enriched as (
    select
      p.id as pid,
      p.name::text as pname,
      p.description::text as pdesc,
      p.category::text as pcat,
      p.image_url::text as pimg,
      p.supplier_id as psup,
      coalesce(mp.min_price, 0)::numeric as min_px,
      coalesce(sp.currency_code, 'USD')::text as scurr,
      sp.user_id::uuid as suid,
      (
        case when c.lname = needle then 50 when c.lname like needle || '%' then 25 else 0 end
        + case when position(needle in c.lname) > 0 then 15 else 0 end
        + case when position(needle in c.lcat) > 0 then 8 else 0 end
        + case when position(needle in c.ldesc) > 0 then 4 else 0 end
      )::numeric as rel_score,
      count(*) over ()::bigint as cnt
    from cand c
    inner join public.products p on p.id = c.cid
    inner join public.suppliers sp on sp.id = p.supplier_id
    left join mpp mp on mp.pid = c.cid
  ),
  labeled as (
    select
      e.pid,
      e.pname,
      e.pdesc,
      e.pcat,
      e.pimg,
      e.psup,
      e.min_px,
      e.scurr,
      e.suid,
      e.rel_score,
      e.cnt,
      nullif(btrim(pr.business_name::text), '') as pbiz,
      coalesce(nullif(btrim(pr.city::text), ''), '') as pcty,
      nullif(btrim(pr.name::text), '') as pnm
    from enriched e
    inner join public.profiles pr on pr.user_id = e.suid
  ),
  ranked as (
    select
      l.*,
      row_number() over (
        order by
          case when v_sort = 'recommended' then -l.rel_score end asc nulls last,
          case when v_sort = 'price_low' then coalesce(l.min_px, 1e30) end asc nulls last,
          case when v_sort = 'price_high' then -coalesce(l.min_px, 0) end asc nulls last,
          case when v_sort = 'name' then lower(l.pname) end asc nulls last,
          l.pid
      )::bigint as rn
    from labeled l
  )
  select
    r.pid as id,
    r.pname as name,
    r.pdesc as description,
    r.pcat as category,
    r.pimg as image_url,
    r.psup as supplier_id,
    r.min_px as variation_min_price,
    r.scurr as supplier_currency,
    r.suid as supplier_user_id,
    r.pbiz as profile_business_name,
    r.pcty as profile_city,
    r.pnm as profile_name,
    r.cnt as total_count
  from ranked r
  where r.rn > off
    and r.rn <= off + lim
  order by r.rn;
end;
$$;

grant execute on function public.search_marketplace_products_paged(text, text, integer, integer) to authenticated;

create or replace function public.supplier_inventory_insights_paged(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  variation_id uuid,
  product_name text,
  variation_label text,
  stock numeric,
  cost_price numeric,
  units_sold_30d numeric,
  last_sale_at timestamptz,
  valuation_line numeric,
  daily_velocity numeric,
  cover_days numeric,
  total_valuation_snapshot numeric,
  reorder_flagged_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with vars as (
    select
      pv.id as vid,
      pv.name::text as vlbl,
      coalesce(pv.stock_quantity, 0)::numeric as stk,
      coalesce(pv.cost_price, 0)::numeric as cp,
      p.name::text as pnm,
      coalesce(vel.units_sold_30d, 0)::numeric as sold30,
      vel.last_sale_at::timestamptz as last_sale,
      greatest(coalesce(pv.stock_quantity, 0)::numeric * coalesce(pv.cost_price, 0)::numeric, 0)::numeric as vline,
      greatest(coalesce(vel.units_sold_30d, 0)::numeric / nullif(30::numeric, 0), 0) as dv
    from public.product_variations pv
    inner join public.products p on p.id = pv.product_id
    inner join public.suppliers s on s.id = p.supplier_id
    left join public.supplier_inventory_velocity_mv vel
      on vel.product_variation_id = pv.id and vel.supplier_id = s.id
    where s.user_id = auth.uid()
  ),
  calc as (
    select
      v.*,
      case
        when v.dv > 0.001 then round((v.stk / v.dv) * 10::numeric) / 10::numeric
        else null::numeric
      end as cov
    from vars v
  ),
  stats as (
    select
      round(coalesce(sum(vline), 0)::numeric, 2) as tv,
      count(*) filter (
        where stk > 0 and cov is not null and cov < 14::numeric and sold30 >= 3
      )::bigint as rfc,
      count(*)::bigint as tc
    from calc
  ),
  numbered as (
    select
      c.vid as variation_id_o,
      c.pnm as product_name_o,
      c.vlbl as variation_label_o,
      c.stk as stock_o,
      c.cp as cost_price_o,
      c.sold30 as units_o,
      c.last_sale as last_sale_o,
      round(c.vline::numeric * 100::numeric) / 100::numeric as valuation_o,
      round(c.dv::numeric * 1000::numeric) / 1000::numeric as dv_o,
      c.cov as cov_o,
      st.tv,
      st.rfc,
      st.tc,
      row_number() over (order by c.sold30 desc nulls last, lower(c.pnm) asc nulls last, c.vid)::bigint as rn
    from calc c
    cross join stats st
  )
  select
    n.variation_id_o as variation_id,
    n.product_name_o as product_name,
    n.variation_label_o as variation_label,
    n.stock_o as stock,
    n.cost_price_o as cost_price,
    n.units_o as units_sold_30d,
    n.last_sale_o as last_sale_at,
    n.valuation_o as valuation_line,
    n.dv_o as daily_velocity,
    n.cov_o as cover_days,
    n.tv as total_valuation_snapshot,
    n.rfc as reorder_flagged_count,
    n.tc as total_count
  from numbered n
  where n.rn > greatest(coalesce(p_offset, 0), 0)::bigint
    and n.rn
      <= greatest(coalesce(p_offset, 0), 0)::bigint + least(greatest(coalesce(p_limit, 20), 1), 100)::bigint
  order by n.rn;
$$;

grant execute on function public.supplier_inventory_insights_paged(integer, integer) to authenticated;
