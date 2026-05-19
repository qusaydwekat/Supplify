-- Supplier cost on variations + profit snapshot on order lines (at acceptance)

alter table public.product_variations
  add column cost_price numeric(10,2) not null default 0 check (cost_price >= 0);

alter table public.product_variations
  add column profit_per_unit numeric(10,2)
  generated always as (price - cost_price) stored;

alter table public.product_variations
  add constraint price_above_cost check (price >= cost_price);

alter table public.order_items
  add column unit_cost_price numeric(10,2) not null default 0 check (unit_cost_price >= 0);

alter table public.order_items
  add column profit_per_unit numeric(10,2)
  generated always as (unit_price - unit_cost_price) stored;

alter table public.order_items
  add column total_profit numeric(10,2)
  generated always as (quantity * (unit_price - unit_cost_price)) stored;

-- Snapshot cost at order acceptance; deduct stock (existing behavior)
create or replace function public.handle_stock_deduction()
returns trigger as $$
begin
  if new.status = 'accepted' and old.status != 'accepted' then
    update public.product_variations pv
    set stock_quantity = pv.stock_quantity - oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and oi.variation_id = pv.id;

    update public.order_items oi
    set unit_cost_price = coalesce(pv.cost_price, 0)
    from public.product_variations pv
    where oi.order_id = new.id
      and oi.variation_id is not null
      and oi.variation_id = pv.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Best-effort backfill for lines already on fulfilled orders (uses current catalog cost)
-- Note: target table "oi" must not appear inside JOIN ... ON of the FROM list; use implicit join + WHERE.
update public.order_items oi
set unit_cost_price = coalesce(pv.cost_price, 0)
from public.orders o,
     public.product_variations pv
where oi.order_id = o.id
  and o.status in ('accepted', 'preparing', 'shipped', 'delivered')
  and oi.variation_id is not null
  and oi.variation_id = pv.id;
