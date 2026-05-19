-- Retailer marketplace discovery: only storefronts owned by users with role `supplier`.
-- Platform admins (role `admin`) may still have a legacy `suppliers` row; they must not appear in browse/search.
-- Operational reads (orders, invoices, ledger) continue to use normal suppliers SELECT policies.

create or replace function public.list_marketplace_suppliers()
returns table (
  id uuid,
  user_id uuid,
  description text,
  delivery_areas text[],
  logo_url text,
  is_active boolean,
  avg_rating numeric,
  review_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.user_id,
    s.description,
    s.delivery_areas,
    s.logo_url,
    s.is_active,
    s.avg_rating,
    s.review_count
  from public.suppliers s
  inner join public.users u on u.id = s.user_id
  where coalesce(s.is_active, true)
    and u.role = 'supplier'::public.user_role;
$$;

grant execute on function public.list_marketplace_suppliers() to authenticated;

create or replace function public.get_marketplace_supplier(p_supplier_id uuid)
returns table (
  id uuid,
  user_id uuid,
  description text,
  delivery_areas text[],
  logo_url text,
  is_active boolean,
  currency_code text,
  avg_rating numeric,
  review_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.user_id,
    s.description,
    s.delivery_areas,
    s.logo_url,
    s.is_active,
    s.currency_code,
    s.avg_rating,
    s.review_count
  from public.suppliers s
  inner join public.users u on u.id = s.user_id
  where s.id = p_supplier_id
    and coalesce(s.is_active, true)
    and u.role = 'supplier'::public.user_role;
$$;

grant execute on function public.get_marketplace_supplier(uuid) to authenticated;

create or replace function public.filter_marketplace_suppliers_by_user_ids(p_user_ids uuid[])
returns table (
  id uuid,
  user_id uuid,
  description text,
  delivery_areas text[],
  logo_url text,
  is_active boolean,
  avg_rating numeric,
  review_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.user_id,
    s.description,
    s.delivery_areas,
    s.logo_url,
    s.is_active,
    s.avg_rating,
    s.review_count
  from public.suppliers s
  inner join public.users u on u.id = s.user_id
  where s.user_id = any(p_user_ids)
    and coalesce(s.is_active, true)
    and u.role = 'supplier'::public.user_role;
$$;

grant execute on function public.filter_marketplace_suppliers_by_user_ids(uuid[]) to authenticated;

create or replace function public.filter_marketplace_supplier_ids(p_supplier_ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(s.id),
    '{}'::uuid[]
  )
  from public.suppliers s
  inner join public.users u on u.id = s.user_id
  where s.id = any(p_supplier_ids)
    and coalesce(s.is_active, true)
    and u.role = 'supplier'::public.user_role;
$$;

grant execute on function public.filter_marketplace_supplier_ids(uuid[]) to authenticated;
