-- Global default currency + FX table (multiply amount in currency_code by to_default_multiplier → default currency units)
create table public.app_settings (
  id smallint primary key check (id = 1),
  default_currency char(3) not null default 'USD'
);

insert into public.app_settings (id, default_currency) values (1, 'USD');

create table public.currency_rates (
  currency_code char(3) primary key,
  to_default_multiplier numeric(18, 8) not null check (to_default_multiplier > 0),
  updated_at timestamptz not null default now()
);

comment on column public.currency_rates.to_default_multiplier is
  'Multiply an amount in currency_code by this value to express it in app_settings.default_currency.';

-- Seed illustrative rates (adjust in production). Allowed currencies: ILS, USD, JOD (amount × multiplier → default currency).
insert into public.currency_rates (currency_code, to_default_multiplier) values
  ('USD', 1),
  ('JOD', 1.41),
  ('ILS', 0.27);

alter table public.app_settings enable row level security;
create policy "app_settings_select_authenticated" on public.app_settings
  for select to authenticated using (true);

alter table public.currency_rates enable row level security;
create policy "currency_rates_select_authenticated" on public.currency_rates
  for select to authenticated using (true);

grant select on public.app_settings to authenticated;
grant select on public.currency_rates to authenticated;

alter table public.suppliers add column currency_code text not null default 'USD';

alter table public.invoices add column currency_code text not null default 'USD';

update public.invoices i
set currency_code = s.currency_code
from public.suppliers s
where s.id = i.supplier_id;

alter table public.payments add column payment_currency text;
alter table public.payments add column payment_amount numeric(10, 2);
alter table public.payments add column amount_in_default_currency numeric(12, 2);

update public.payments p
set
  payment_currency = coalesce(i.currency_code, 'USD'),
  payment_amount = p.amount,
  amount_in_default_currency = round(
    (p.amount * coalesce(cr.to_default_multiplier, 1))::numeric,
    2
  )
from public.invoices i
left join public.currency_rates cr
  on upper(trim(cr.currency_code::text)) = upper(trim(coalesce(i.currency_code, 'USD')))
where p.invoice_id = i.id;

alter table public.payments alter column payment_currency set not null;
alter table public.payments alter column payment_amount set not null;
alter table public.payments alter column amount_in_default_currency set not null;
alter table public.payments alter column payment_currency set default 'USD';

create or replace function public.create_invoice_from_order(
  p_order_id uuid,
  p_supplier_user_id uuid,
  p_notes text,
  p_due_days int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_order record;
  v_inv_id uuid;
  v_due_days int;
  v_currency text;
begin
  if p_supplier_user_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  v_due_days := greatest(1, least(coalesce(p_due_days, 14), 365));

  select s.id, s.currency_code into v_supplier_id, v_currency
  from public.suppliers s
  where s.user_id = p_supplier_user_id;

  if v_supplier_id is null then
    raise exception 'Not a supplier';
  end if;

  select * into v_order
  from public.orders o
  where o.id = p_order_id
    and o.supplier_id = v_supplier_id
    and o.status = 'delivered';

  if v_order is null then
    raise exception 'Order not found or not delivered';
  end if;

  if exists (select 1 from public.invoices i where i.order_id = p_order_id) then
    raise exception 'Invoice already exists for this order';
  end if;

  if not exists (select 1 from public.order_items oi where oi.order_id = p_order_id) then
    raise exception 'Order has no line items';
  end if;

  insert into public.invoices (
    order_id,
    supplier_id,
    retailer_id,
    total,
    status,
    type,
    notes,
    due_date,
    currency_code
  )
  values (
    p_order_id,
    v_supplier_id,
    v_order.retailer_id,
    v_order.total_price,
    'issued',
    'final',
    nullif(trim(coalesce(p_notes, '')), ''),
    now() + v_due_days * interval '1 day',
    coalesce(nullif(trim(v_currency), ''), 'USD')
  )
  returning id into v_inv_id;

  insert into public.invoice_items (invoice_id, product_name, variation_name, quantity, unit_price)
  select
    v_inv_id,
    oi.product_name,
    oi.variation_name,
    oi.quantity,
    oi.unit_price
  from public.order_items oi
  where oi.order_id = p_order_id;

  return v_inv_id;
end;
$$;

grant execute on function public.create_invoice_from_order(uuid, uuid, text, int) to authenticated;
