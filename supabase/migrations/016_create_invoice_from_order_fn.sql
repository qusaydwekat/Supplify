-- Atomic invoice + line items in one transaction (ledger trigger runs only on successful commit)
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
begin
  if p_supplier_user_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  v_due_days := greatest(1, least(coalesce(p_due_days, 14), 365));

  select s.id into v_supplier_id
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
    due_date
  )
  values (
    p_order_id,
    v_supplier_id,
    v_order.retailer_id,
    v_order.total_price,
    'issued',
    'final',
    nullif(trim(coalesce(p_notes, '')), ''),
    now() + v_due_days * interval '1 day'
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
