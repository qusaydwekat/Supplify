-- Optional one-off: identify invoices / payments that never received journal rows after enabling double-entry.
-- Run in SQL editor as an admin; adjust before executing inserts.

select i.id, i.invoice_number, i.supplier_id
from public.invoices i
where not exists (
  select 1 from public.journal_entries je
  where je.supplier_id = i.supplier_id
    and je.reference_type = 'invoice'
    and je.reference_id = i.id
)
limit 50;

select p.id, p.invoice_id, p.amount
from public.payments p
join public.invoices i on i.id = p.invoice_id
where not exists (
  select 1 from public.journal_entries je
  where je.supplier_id = i.supplier_id
    and je.reference_type = 'payment'
    and je.reference_id = p.id
)
limit 50;

-- Fixing gaps typically requires replaying the same logic as triggers post_journal_from_invoice / post_journal_from_payment
-- (chart of accounts must exist per supplier). Prefer adding a guarded RPC in-app than manual inserts.
