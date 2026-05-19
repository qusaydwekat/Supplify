-- Overdue invoice reminders: store translation keys so the UI shows Arabic (or EN) via next-intl.

create or replace function public.enqueue_overdue_invoice_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int := 0;
  r record;
begin
  for r in
    select distinct on (i.id)
      i.id as invoice_id,
      i.supplier_id,
      i.retailer_id,
      i.invoice_number,
      s.user_id as supplier_user_id,
      i.total - coalesce(pt.paid, 0) as open_amount
    from public.invoices i
    join public.suppliers s on s.id = i.supplier_id
    left join lateral (
      select sum(p.amount) as paid from public.payments p where p.invoice_id = i.id
    ) pt on true
    where i.due_date is not null
      and i.due_date < timezone('utc', now())
      and i.status in ('issued'::public.invoice_status, 'partial'::public.invoice_status, 'overdue'::public.invoice_status)
      and i.total > coalesce(pt.paid, 0)
      and not exists (
        select 1 from public.notifications n
        where n.reference_id = i.id
          and n.type = 'overdue_invoice'::public.notification_type
          and n.created_at > timezone('utc', now()) - interval '24 hours'
      )
  loop
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      title_key,
      message_key,
      params,
      reference_id,
      reference_type
    )
    values (
      r.supplier_user_id,
      'overdue_invoice'::public.notification_type,
      'Overdue invoice',
      'Invoice ' || coalesce(r.invoice_number, '') || ' has an open balance of ' || round(r.open_amount::numeric, 2)::text,
      'overdueInvoice.title',
      'overdueInvoice.message',
      jsonb_build_object(
        'invoiceNumber', coalesce(r.invoice_number, ''),
        'amount', round(r.open_amount::numeric, 2)::text
      ),
      r.invoice_id,
      'invoice'
    );
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;
