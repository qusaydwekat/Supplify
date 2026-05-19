-- Auto-insert ledger entry when invoice is created
create or replace function handle_invoice_ledger()
returns trigger as $$
begin
  insert into public.ledger_entries (supplier_id, retailer_id, type, amount, reference_id, description)
  values (
    new.supplier_id,
    new.retailer_id,
    'invoice',
    new.total,
    new.id,
    'Invoice ' || new.invoice_number
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_invoice_created
  after insert on public.invoices
  for each row execute function handle_invoice_ledger();

-- Auto-insert ledger entry when payment is recorded
create or replace function handle_payment_ledger()
returns trigger as $$
declare
  v_supplier_id uuid;
  v_retailer_id uuid;
  v_invoice_number text;
begin
  select i.supplier_id, i.retailer_id, i.invoice_number
  into v_supplier_id, v_retailer_id, v_invoice_number
  from public.invoices i where i.id = new.invoice_id;

  insert into public.ledger_entries (supplier_id, retailer_id, type, amount, reference_id, description)
  values (
    v_supplier_id,
    v_retailer_id,
    'payment',
    -new.amount,  -- NEGATIVE for payments
    new.id,
    'Payment for ' || v_invoice_number
  );

  -- Update invoice status
  update public.invoices set
    status = case
      when (select coalesce(sum(p.amount), 0) from public.payments p where p.invoice_id = new.invoice_id) >= total then 'paid'
      when (select coalesce(sum(p.amount), 0) from public.payments p where p.invoice_id = new.invoice_id) > 0 then 'partial'
      else 'issued'
    end,
    paid_at = case
      when (select coalesce(sum(p.amount), 0) from public.payments p where p.invoice_id = new.invoice_id) >= total then now()
      else null
    end
  where id = new.invoice_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_payment_created
  after insert on public.payments
  for each row execute function handle_payment_ledger();

-- Auto-deduct stock when order is accepted
create or replace function handle_stock_deduction()
returns trigger as $$
begin
  if new.status = 'accepted' and old.status != 'accepted' then
    update public.product_variations pv
    set stock_quantity = pv.stock_quantity - oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and oi.variation_id = pv.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_order_status_changed
  after update on public.orders
  for each row execute function handle_stock_deduction();

