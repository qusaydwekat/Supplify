-- Phase 5: alerts RPCs, marketplace catalog_status, supplier team RBAC foundation.

-- ---------------------------------------------------------------------------
-- Supplier team (owner remains suppliers.user_id; members get delegated access)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_team_members (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('manager', 'viewer')),
  created_at timestamptz not null default now(),
  unique (supplier_id, user_id)
);

create index if not exists idx_supplier_team_members_user
  on public.supplier_team_members (user_id);

alter table public.supplier_team_members enable row level security;

drop policy if exists "Team members readable by supplier owner" on public.supplier_team_members;
create policy "Team members readable by supplier owner"
  on public.supplier_team_members for select to authenticated using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_team_members.supplier_id and s.user_id = auth.uid()
    )
    or user_id = auth.uid()
  );

drop policy if exists "Supplier owner manages team" on public.supplier_team_members;
create policy "Supplier owner manages team"
  on public.supplier_team_members for all using (
    exists (
      select 1 from public.suppliers s
      where s.id = supplier_team_members.supplier_id and s.user_id = auth.uid()
    )
  );

create or replace function public.auth_user_supplier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.id from public.suppliers s where s.user_id = auth.uid() limit 1),
    (select tm.supplier_id from public.supplier_team_members tm where tm.user_id = auth.uid() limit 1)
  );
$$;

grant execute on function public.auth_user_supplier_id() to authenticated;

create or replace function public.auth_user_supplier_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select 'owner' from public.suppliers s where s.user_id = auth.uid() limit 1),
    (select tm.role from public.supplier_team_members tm where tm.user_id = auth.uid() limit 1)
  );
$$;

grant execute on function public.auth_user_supplier_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Low-stock SKU count (reorder_point aware)
-- ---------------------------------------------------------------------------
create or replace function public.supplier_low_stock_sku_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.product_variations pv
  inner join public.products p on p.id = pv.product_id
  where p.supplier_id = public.auth_user_supplier_id()
    and coalesce(pv.is_active, true)
    and coalesce(pv.stock_quantity, 0)
      <= public.variation_low_stock_threshold(pv.min_order_quantity, pv.reorder_point);
$$;

grant execute on function public.supplier_low_stock_sku_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Catalog / alert summary for dashboard
-- ---------------------------------------------------------------------------
create or replace function public.supplier_catalog_alert_stats()
returns table (
  low_stock_skus bigint,
  draft_products bigint,
  unpublished_active bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select p.id, p.catalog_status, p.is_active
    from public.products p
    where p.supplier_id = public.auth_user_supplier_id()
  )
  select
    public.supplier_low_stock_sku_count() as low_stock_skus,
    count(*) filter (where catalog_status = 'draft'::public.product_catalog_status)::bigint as draft_products,
    count(*) filter (
      where catalog_status <> 'published'::public.product_catalog_status
        and coalesce(is_active, true)
    )::bigint as unpublished_active
  from scoped;
$$;

grant execute on function public.supplier_catalog_alert_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Marketplace search: only published catalog products
-- ---------------------------------------------------------------------------
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
      and prd.catalog_status = 'published'::public.product_catalog_status
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
      e.*,
      pr.business_name as pbiz,
      pr.city as pcity,
      pr.name as pname2
    from enriched e
    left join public.profiles pr on pr.user_id = e.suid
  )
  select
    l.pid as id,
    l.pname as name,
    l.pdesc as description,
    l.pcat as category,
    l.pimg as image_url,
    l.psup as supplier_id,
    l.min_px as variation_min_price,
    l.scurr as supplier_currency,
    l.suid as supplier_user_id,
    l.pbiz as profile_business_name,
    l.pcity as profile_city,
    l.pname2 as profile_name,
    l.cnt as total_count
  from labeled l
  order by
    case when v_sort = 'price_asc' then l.min_px end asc nulls last,
    case when v_sort = 'price_desc' then l.min_px end desc nulls last,
    case when v_sort = 'name' then l.pname end asc nulls last,
    l.rel_score desc,
    l.pname asc
  limit lim offset off;
end;
$$;

grant execute on function public.search_marketplace_products_paged(text, text, integer, integer) to authenticated;
