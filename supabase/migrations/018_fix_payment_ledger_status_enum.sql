-- CASE branches were inferred as text; status column is invoice_status enum.
create or replace function public.handle_payment_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
    -new.amount,
    new.id,
    'Payment for ' || v_invoice_number
  );

  update public.invoices set
    status = (
      case
        when (select coalesce(sum(p.amount), 0) from public.payments p where p.invoice_id = new.invoice_id) >= total
          then 'paid'::public.invoice_status
        when (select coalesce(sum(p.amount), 0) from public.payments p where p.invoice_id = new.invoice_id) > 0
          then 'partial'::public.invoice_status
        else 'issued'::public.invoice_status
      end
    ),
    paid_at = case
      when (select coalesce(sum(p.amount), 0) from public.payments p where p.invoice_id = new.invoice_id) >= total then now()
      else null
    end
  where id = new.invoice_id;

  return new;
end;
$$;
