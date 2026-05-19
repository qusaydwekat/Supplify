-- Bounced cheques zero out applied invoice amount (see markChequeBounced).
-- Original constraint required amount > 0, which blocked that UPDATE.

alter table public.payments
  drop constraint if exists payments_amount_check;

alter table public.payments
  add constraint payments_amount_check check (
    amount > 0
    or (
      amount = 0
      and method = 'cheque'::public.payment_method
      and cheque_status = 'bounced'::public.cheque_status
    )
  );

-- perform_refresh_payment_journal inserted debit/credit = amount on both lines.
-- journal_entry_lines requires exactly one side > 0 per row, so amount = 0 must omit lines.

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

  if coalesce(p_pay.amount, 0) > 0 then
    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit)
    values
      (jid, cash_id, p_pay.amount, 0),
      (jid, ar_id, 0, p_pay.amount);
  end if;
end;
$$;
