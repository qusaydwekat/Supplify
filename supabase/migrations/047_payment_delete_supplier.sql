-- Supplier payment deletion: reverse partner ledger effect, refresh invoice status, drop GL journal row.
-- Installment allocations cascade from payment_installment_allocations (FK on delete cascade).

create or replace function public.handle_payment_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_retailer_id uuid;
  v_invoice_number text;
  v_total numeric;
  v_invoice_id uuid;
  v_sum numeric;
begin
  v_invoice_id := OLD.invoice_id;

  select i.supplier_id, i.retailer_id, i.invoice_number, i.total
  into v_supplier_id, v_retailer_id, v_invoice_number, v_total
  from public.invoices i
  where i.id = v_invoice_id;

  -- Append-only ledger: original payment rows were negative; removal restores AR with a positive line.
  insert into public.ledger_entries (supplier_id, retailer_id, type, amount, reference_id, description)
  values (
    v_supplier_id,
    v_retailer_id,
    'payment'::public.ledger_entry_type,
    OLD.amount,
    OLD.id,
    'Payment removed — ' || coalesce(v_invoice_number, '')
  );

  select coalesce(sum(p.amount), 0) into v_sum
  from public.payments p
  where p.invoice_id = v_invoice_id;

  update public.invoices
  set
    status = (
      case
        when v_sum >= v_total then 'paid'::public.invoice_status
        when v_sum > 0 then 'partial'::public.invoice_status
        else 'issued'::public.invoice_status
      end
    ),
    paid_at = case
      when v_sum >= v_total then now()
      else null
    end
  where id = v_invoice_id;

  delete from public.journal_entries
  where supplier_id = v_supplier_id
    and reference_type = 'payment'
    and reference_id = OLD.id;

  return OLD;
end;
$$;

drop trigger if exists trg_payment_deleted on public.payments;
create trigger trg_payment_deleted
  after delete on public.payments
  for each row
  execute function public.handle_payment_deleted();

create policy "Suppliers can delete payments on own invoices"
  on public.payments for delete to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      join public.suppliers s on s.id = i.supplier_id
      where i.id = payments.invoice_id and s.user_id = auth.uid()
    )
  );
