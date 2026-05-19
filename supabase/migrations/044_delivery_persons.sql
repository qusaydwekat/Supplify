-- Delivery persons (supplier-owned contacts, not auth users) + order assignment + ship validation

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.delivery_persons (
  id uuid default uuid_generate_v4() primary key,
  supplier_id uuid references public.suppliers (id) on delete cascade not null,
  name text not null,
  phone text not null,
  is_active boolean default true not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_delivery_persons_supplier_id on public.delivery_persons (supplier_id);

create index idx_delivery_persons_supplier_active on public.delivery_persons (supplier_id, is_active)
  where is_active = true;

alter table public.delivery_persons enable row level security;

-- Suppliers: full CRUD on own rows
create policy "delivery_persons_supplier_all"
  on public.delivery_persons for all to authenticated
  using (
    exists (
      select 1 from public.suppliers s
      where s.id = delivery_persons.supplier_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.suppliers s
      where s.id = delivery_persons.supplier_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Orders FK (required before retailer policy references delivery_person_id)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column delivery_person_id uuid references public.delivery_persons (id) on delete set null;

create index idx_orders_delivery_person_id on public.orders (delivery_person_id)
  where delivery_person_id is not null;

comment on column public.orders.delivery_person_id is
  'Set when order ships; supplier-scoped delivery contact for retailer visibility.';

-- Retailers: read-only for drivers assigned to their orders (name + phone)
create policy "delivery_persons_retailer_select_assigned"
  on public.delivery_persons for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.delivery_person_id = delivery_persons.id
        and o.retailer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger: require valid delivery person when entering shipped + on reassignment
-- ---------------------------------------------------------------------------
create or replace function public.enforce_delivery_person_on_ship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- First transition into shipped
  if new.status = 'shipped'::public.order_status and old.status is distinct from 'shipped'::public.order_status then
    if new.delivery_person_id is null then
      raise exception 'Cannot mark order as shipped without assigning a delivery person.'
        using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.delivery_persons dp
      where dp.id = new.delivery_person_id
        and dp.supplier_id = new.supplier_id
        and dp.is_active = true
    ) then
      raise exception 'Delivery person does not belong to this supplier or is inactive.'
        using errcode = 'P0002';
    end if;
  end if;

  -- Reassign while already shipped
  if new.status = 'shipped'::public.order_status
     and old.status = 'shipped'::public.order_status
     and new.delivery_person_id is distinct from old.delivery_person_id then
    if new.delivery_person_id is null then
      raise exception 'Cannot clear delivery person while order is shipped.'
        using errcode = 'P0003';
    end if;
    if not exists (
      select 1 from public.delivery_persons dp
      where dp.id = new.delivery_person_id
        and dp.supplier_id = new.supplier_id
        and dp.is_active = true
    ) then
      raise exception 'Delivery person does not belong to this supplier or is inactive.'
        using errcode = 'P0002';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists check_delivery_person_before_ship on public.orders;

create trigger check_delivery_person_before_ship
  before update on public.orders
  for each row execute function public.enforce_delivery_person_on_ship();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
do $nt$
begin
  alter type public.notification_type add value 'delivery_assigned';
exception
  when duplicate_object then null;
end
$nt$;
