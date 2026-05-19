-- Phase 1 ERP-lite: inventory movements (source of truth for stock cache), expenses, returns, credit enforcement

-- ---------------------------------------------------------------------------
-- Inventory movement types
-- Sign convention: quantity always > 0; stock delta = f(type, adjustment_increase)
--   purchase, return: +qty | sale, damage: -qty | adjustment: ±qty via adjustment_increase
-- ---------------------------------------------------------------------------
do $inv_enum$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_movement_type') then
    create type public.inventory_movement_type as enum (
      'purchase',
      'sale',
      'return',
      'adjustment',
      'damage'
    );
  end if;
end
$inv_enum$;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  product_variation_id uuid not null references public.product_variations (id) on delete cascade,
  type public.inventory_movement_type not null,
  quantity integer not null check (quantity > 0),
  adjustment_increase boolean not null default true,
  reference_type text not null,
  reference_id uuid not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint inventory_movements_adjustment_ok check (
    type <> 'adjustment'::public.inventory_movement_type
    or true
  )
);

comment on table public.inventory_movements is
  'Append-only inventory traceability. Stock on product_variations is a cache updated only via triggers from this table.';
comment on column public.inventory_movements.adjustment_increase is
  'When type=adjustment: true adds quantity to stock, false subtracts.';
comment on column public.inventory_movements.reference_type is
  'e.g. order_item, opening_balance, manual_adjustment, customer_return, purchase_order';

create index idx_inventory_movements_variation_created on public.inventory_movements (product_variation_id, created_at desc);
create index idx_inventory_movements_supplier_created on public.inventory_movements (supplier_id, created_at desc);
create index idx_inventory_movements_reference on public.inventory_movements (reference_type, reference_id);

create unique index if not exists idx_inventory_move_order_item_sale
  on public.inventory_movements (reference_type, reference_id)
  where type = 'sale'::public.inventory_movement_type;

create unique index if not exists idx_inventory_move_opening_per_variation
  on public.inventory_movements (product_variation_id)
  where reference_type = 'opening_balance';

-- Apply movement to stock cache (product_variations.stock_quantity)
create or replace function public.apply_inventory_movement_to_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer;
begin
  delta := case NEW.type
    when 'purchase'::public.inventory_movement_type then NEW.quantity
    when 'return'::public.inventory_movement_type then NEW.quantity
    when 'sale'::public.inventory_movement_type then -NEW.quantity
    when 'damage'::public.inventory_movement_type then -NEW.quantity
    when 'adjustment'::public.inventory_movement_type then
      case when NEW.adjustment_increase then NEW.quantity else -NEW.quantity end
  end;

  update public.product_variations
  set
    stock_quantity = greatest(0, stock_quantity + delta),
    updated_at = now()
  where id = NEW.product_variation_id;

  return NEW;
end;
$$;

drop trigger if exists trg_inventory_movement_stock on public.inventory_movements;
create trigger trg_inventory_movement_stock
  after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement_to_stock();

-- Replace direct stock deduction with movement rows (matches profit snapshot timing)
create or replace function public.handle_order_accepted_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'accepted'::public.order_status and OLD.status is distinct from 'accepted'::public.order_status then
    -- Snapshot unit costs before inventory movements so COGS journals see correct costs.
    update public.order_items oi
    set unit_cost_price = coalesce(pv.cost_price, 0)
    from public.product_variations pv
    where oi.order_id = NEW.id
      and oi.variation_id is not null
      and oi.variation_id = pv.id;

    insert into public.inventory_movements (
      supplier_id,
      product_variation_id,
      type,
      quantity,
      adjustment_increase,
      reference_type,
      reference_id
    )
    select
      o.supplier_id,
      oi.variation_id,
      'sale'::public.inventory_movement_type,
      oi.quantity,
      true,
      'order_item',
      oi.id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.order_id = NEW.id
      and oi.variation_id is not null
      and not exists (
        select 1
        from public.inventory_movements m
        where m.reference_type = 'order_item'
          and m.reference_id = oi.id
          and m.type = 'sale'::public.inventory_movement_type
      );
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_order_status_changed on public.orders;
create trigger on_order_status_changed
  after update on public.orders
  for each row execute function public.handle_order_accepted_inventory();

-- Backfill: movement-based stock — zero cache then replay opening balances as adjustments
do $open$
declare
  r record;
begin
  for r in
    select pv.id as vid, pv.stock_quantity as sq, p.supplier_id as sid
    from public.product_variations pv
    join public.products p on p.id = pv.product_id
  loop
    if r.sq > 0 then
      update public.product_variations set stock_quantity = 0, updated_at = now() where id = r.vid;
      insert into public.inventory_movements (
        supplier_id,
        product_variation_id,
        type,
        quantity,
        adjustment_increase,
        reference_type,
        reference_id,
        notes
      )
      values (
        r.sid,
        r.vid,
        'adjustment'::public.inventory_movement_type,
        r.sq,
        true,
        'opening_balance',
        r.vid,
        'ERP migration: opening balance'
      );
    end if;
  end loop;
end
$open$;

alter table public.inventory_movements enable row level security;

create policy "inventory_movements_select_supplier"
  on public.inventory_movements for select to authenticated
  using (
    exists (
      select 1 from public.suppliers s
      where s.id = inventory_movements.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "inventory_movements_insert_supplier"
  on public.inventory_movements for insert to authenticated
  with check (
    exists (
      select 1 from public.suppliers s
      where s.id = inventory_movements.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "inventory_movements_select_admin"
  on public.inventory_movements for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Expenses (supplier operating costs; net profit = revenue - COGS - expenses)
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency_code text not null default 'USD',
  description text,
  expense_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id)
);

create index idx_expenses_supplier_date on public.expenses (supplier_id, expense_date desc);

alter table public.expenses enable row level security;

create policy "expenses_supplier_all"
  on public.expenses for all to authenticated
  using (
    exists (
      select 1 from public.suppliers s
      where s.id = expenses.supplier_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.suppliers s
      where s.id = expenses.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "expenses_select_admin"
  on public.expenses for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Returns (avoid reserved word "returns" — use product_returns)
-- ---------------------------------------------------------------------------
do $ret_enum$
begin
  if not exists (select 1 from pg_type where typname = 'customer_return_status') then
    create type public.customer_return_status as enum ('draft', 'pending', 'approved', 'rejected', 'cancelled');
  end if;
end
$ret_enum$;

do $cond_enum$
begin
  if not exists (select 1 from pg_type where typname = 'return_item_condition') then
    create type public.return_item_condition as enum ('restockable', 'damaged');
  end if;
end
$cond_enum$;

create table if not exists public.product_returns (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  retailer_id uuid not null references public.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  status public.customer_return_status not null default 'draft',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.product_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.product_returns (id) on delete cascade,
  product_variation_id uuid not null references public.product_variations (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  condition public.return_item_condition not null default 'restockable',
  unit_credit numeric(12, 2) check (unit_credit is null or unit_credit >= 0),
  notes text
);

create index idx_product_returns_supplier on public.product_returns (supplier_id, created_at desc);
create index idx_product_returns_retailer on public.product_returns (retailer_id, created_at desc);
create index idx_product_return_items_return on public.product_return_items (return_id);

alter table public.product_returns enable row level security;
alter table public.product_return_items enable row level security;

create policy "product_returns_supplier"
  on public.product_returns for all to authenticated
  using (
    exists (
      select 1 from public.suppliers s
      where s.id = product_returns.supplier_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.suppliers s
      where s.id = product_returns.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "product_returns_retailer_select"
  on public.product_returns for select to authenticated
  using (auth.uid() = retailer_id);

create policy "product_returns_admin"
  on public.product_returns for select to authenticated
  using (public.is_platform_admin());

create policy "product_return_items_supplier"
  on public.product_return_items for all to authenticated
  using (
    exists (
      select 1
      from public.product_returns pr
      join public.suppliers s on s.id = pr.supplier_id
      where pr.id = product_return_items.return_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.product_returns pr
      join public.suppliers s on s.id = pr.supplier_id
      where pr.id = product_return_items.return_id and s.user_id = auth.uid()
    )
  );

create policy "product_return_items_retailer_select"
  on public.product_return_items for select to authenticated
  using (
    exists (
      select 1 from public.product_returns pr
      where pr.id = product_return_items.return_id and pr.retailer_id = auth.uid()
    )
  );

create policy "product_return_items_admin"
  on public.product_return_items for select to authenticated
  using (public.is_platform_admin());

-- Append-only invoice adjustments (credit from returns, manual fixes)
create table if not exists public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  amount numeric(12, 2) not null,
  reason text,
  product_return_id uuid references public.product_returns (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  constraint invoice_adjustments_amount_positive check (amount > 0)
);

comment on table public.invoice_adjustments is
  'Append-only credit/adjustment lines; amount negative reduces AR (same sign convention as payments).';

create index idx_invoice_adjustments_invoice on public.invoice_adjustments (invoice_id);

alter table public.invoice_adjustments enable row level security;

create policy "invoice_adjustments_participants"
  on public.invoice_adjustments for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_adjustments.invoice_id
        and (
          i.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = i.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

create policy "invoice_adjustments_supplier_insert"
  on public.invoice_adjustments for insert to authenticated
  with check (
    exists (
      select 1 from public.suppliers s
      where s.id = invoice_adjustments.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "invoice_adjustments_admin"
  on public.invoice_adjustments for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Credit enforcement mode (extends retailer_supplier_terms)
-- ---------------------------------------------------------------------------
do $ce$
begin
  if not exists (select 1 from pg_type where typname = 'credit_enforcement_mode') then
    create type public.credit_enforcement_mode as enum ('block', 'warn');
  end if;
end
$ce$;

alter table public.retailer_supplier_terms
  add column if not exists credit_enforcement_mode public.credit_enforcement_mode not null default 'block';

comment on column public.retailer_supplier_terms.credit_enforcement_mode is
  'block: reject orders over limit; warn: allow but surface warning (handled in app).';

-- Ledger hook: invoice adjustments (credit) append matching ledger line
create or replace function public.handle_invoice_adjustment_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retailer_id uuid;
begin
  select i.retailer_id into v_retailer_id
  from public.invoices i
  where i.id = NEW.invoice_id;

  if v_retailer_id is null then
    raise exception 'Invoice not found for adjustment';
  end if;

  insert into public.ledger_entries (supplier_id, retailer_id, type, amount, reference_id, description)
  values (
    NEW.supplier_id,
    v_retailer_id,
    'credit_note'::public.ledger_entry_type,
    -(abs(NEW.amount)),
    NEW.id,
    coalesce(NEW.reason, 'Invoice adjustment')
  );

  return NEW;
end;
$$;

drop trigger if exists on_invoice_adjustment_ledger on public.invoice_adjustments;
create trigger on_invoice_adjustment_ledger
  after insert on public.invoice_adjustments
  for each row execute function public.handle_invoice_adjustment_ledger();
