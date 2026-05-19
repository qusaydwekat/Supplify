-- Supplier storefront categories for retailer browse/search filtering.

do $e$
begin
  create type public.supplier_marketplace_category as enum (
    'food_beverages',
    'clothing_fashion',
    'pharmacy_health',
    'electronics_tech',
    'home_garden',
    'beauty_personal_care',
    'automotive',
    'office_school',
    'sports_hobbies',
    'general_merchandise'
  );
exception
  when duplicate_object then null;
end $e$;

alter table public.suppliers
  add column if not exists marketplace_categories public.supplier_marketplace_category[]
    not null default '{}'::public.supplier_marketplace_category[];

comment on column public.suppliers.marketplace_categories is
  'Industry categories retailers use to browse/filter suppliers (supplier-editable). Empty = uncategorized only in that filter.';

create index if not exists idx_suppliers_marketplace_categories_gin
  on public.suppliers using gin (marketplace_categories);

-- ---------------------------------------------------------------------------
-- Marketplace RPCs include marketplace_categories.
-- Must DROP first: Postgres does not allow CREATE OR REPLACE when OUT row type changes.
-- ---------------------------------------------------------------------------

drop function if exists public.list_marketplace_suppliers();
drop function if exists public.get_marketplace_supplier(uuid);
drop function if exists public.filter_marketplace_suppliers_by_user_ids(uuid[]);

create function public.list_marketplace_suppliers()
returns table (
  id uuid,
  user_id uuid,
  description text,
  delivery_areas text[],
  logo_url text,
  is_active boolean,
  avg_rating numeric,
  review_count integer,
  marketplace_categories public.supplier_marketplace_category[]
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
    s.review_count,
    s.marketplace_categories
  from public.suppliers s
  inner join public.users u on u.id = s.user_id
  where coalesce(s.is_active, true)
    and u.role = 'supplier'::public.user_role;
$$;

grant execute on function public.list_marketplace_suppliers() to authenticated;

create function public.get_marketplace_supplier(p_supplier_id uuid)
returns table (
  id uuid,
  user_id uuid,
  description text,
  delivery_areas text[],
  logo_url text,
  is_active boolean,
  currency_code text,
  avg_rating numeric,
  review_count integer,
  marketplace_categories public.supplier_marketplace_category[]
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
    s.review_count,
    s.marketplace_categories
  from public.suppliers s
  inner join public.users u on u.id = s.user_id
  where s.id = p_supplier_id
    and coalesce(s.is_active, true)
    and u.role = 'supplier'::public.user_role;
$$;

grant execute on function public.get_marketplace_supplier(uuid) to authenticated;

create function public.filter_marketplace_suppliers_by_user_ids(p_user_ids uuid[])
returns table (
  id uuid,
  user_id uuid,
  description text,
  delivery_areas text[],
  logo_url text,
  is_active boolean,
  avg_rating numeric,
  review_count integer,
  marketplace_categories public.supplier_marketplace_category[]
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
    s.review_count,
    s.marketplace_categories
  from public.suppliers s
  inner join public.users u on u.id = s.user_id
  where s.user_id = any(p_user_ids)
    and coalesce(s.is_active, true)
    and u.role = 'supplier'::public.user_role;
$$;

grant execute on function public.filter_marketplace_suppliers_by_user_ids(uuid[]) to authenticated;
