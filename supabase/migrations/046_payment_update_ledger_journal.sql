-- Allow suppliers to correct recorded payments: UPDATE on payments + ledger/journal consistency.
-- Ledger is append-only: amount changes insert an adjustment line (OLD.amount - NEW.amount).

-- Reusable journal refresh for a payment row (insert and update).
create or replace function public.perform_refresh_payment_journal(p_pay public.payments)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
  cash_id uuid;
  ar_id uuid;
  inv record;
  fx jsonb;
begin
  select supplier_id, retailer_id, currency_code into inv
  from public.invoices
  where id = p_pay.invoice_id;

  if inv.supplier_id is null then
    raise exception 'Invoice not found for payment';
  end if;

  cash_id := public.coa_account_id(inv.supplier_id, '1000');
  ar_id := public.coa_account_id(inv.supplier_id, '1100');
  if cash_id is null or ar_id is null then
    raise exception 'Chart of accounts not seeded for supplier %', inv.supplier_id;
  end if;

  fx := coalesce(p_pay.fx_snapshot, public.capture_payment_fx_snapshot(p_pay.id));

  insert into public.journal_entries (supplier_id, retailer_id, reference_type, reference_id, description, fx_snapshot)
  values (
    inv.supplier_id,
    inv.retailer_id,
    'payment',
    p_pay.id,
    'Payment allocation',
    fx
  )
  on conflict (supplier_id, reference_type, reference_id) do nothing
  returning id into jid;

  if jid is null then
    select je.id into jid
    from public.journal_entries je
    where je.supplier_id = inv.supplier_id
      and je.reference_type = 'payment'
      and je.reference_id = p_pay.id;
  end if;

  delete from public.journal_entry_lines where journal_entry_id = jid;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit)
  values
    (jid, cash_id, p_pay.amount, 0),
    (jid, ar_id, 0, p_pay.amount);
end;
$$;

create or replace function public.post_journal_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.perform_refresh_payment_journal(NEW);
  return NEW;
end;
$$;

create or replace function public.handle_payment_updated()
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
  if OLD.amount is distinct from NEW.amount then
    select i.supplier_id, i.retailer_id, i.invoice_number
    into v_supplier_id, v_retailer_id, v_invoice_number
    from public.invoices i
    where i.id = NEW.invoice_id;

    insert into public.ledger_entries (supplier_id, retailer_id, type, amount, reference_id, description)
    values (
      v_supplier_id,
      v_retailer_id,
      'payment'::public.ledger_entry_type,
      OLD.amount - NEW.amount,
      NEW.id,
      'Payment adjustment — ' || coalesce(v_invoice_number, '')
    );
  end if;

  update public.invoices
  set
    status = (
      case
        when (
          select coalesce(sum(p.amount), 0)
          from public.payments p
          where p.invoice_id = NEW.invoice_id
        ) >= total
          then 'paid'::public.invoice_status
        when (
          select coalesce(sum(p.amount), 0)
          from public.payments p
          where p.invoice_id = NEW.invoice_id
        ) > 0
          then 'partial'::public.invoice_status
        else 'issued'::public.invoice_status
      end
    ),
    paid_at = case
      when (
        select coalesce(sum(p.amount), 0)
        from public.payments p
        where p.invoice_id = NEW.invoice_id
      ) >= total then now()
      else null
    end
  where id = NEW.invoice_id;

  perform public.perform_refresh_payment_journal(NEW);

  return NEW;
end;
$$;

drop trigger if exists trg_payment_updated on public.payments;
create trigger trg_payment_updated
  after update on public.payments
  for each row
  execute function public.handle_payment_updated();

-- Refresh FX snapshot when correcting an existing payment.
drop trigger if exists trg_payment_fx_snapshot on public.payments;
create trigger trg_payment_fx_snapshot
  before insert or update on public.payments
  for each row
  execute function public.set_payment_fx_snapshot();

create policy "Suppliers can update payments on own invoices"
  on public.payments for update to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      join public.suppliers s on s.id = i.supplier_id
      where i.id = payments.invoice_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      join public.suppliers s on s.id = i.supplier_id
      where i.id = payments.invoice_id and s.user_id = auth.uid()
    )
  );
