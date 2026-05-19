-- Balance per retailer per supplier (for fast balance lookups)
create view public.retailer_balances as
select
  supplier_id,
  retailer_id,
  sum(amount) as balance,
  count(*) filter (where type = 'invoice') as invoice_count,
  count(*) filter (where type = 'payment') as payment_count
from public.ledger_entries
group by supplier_id, retailer_id;

-- Supplier revenue summary
create view public.supplier_revenue as
select
  s.id as supplier_id,
  coalesce(sum(le.amount) filter (where le.type = 'invoice'), 0) as total_invoiced,
  coalesce(sum(-le.amount) filter (where le.type = 'payment'), 0) as total_collected,
  coalesce(sum(le.amount), 0) as outstanding_balance
from public.suppliers s
left join public.ledger_entries le on le.supplier_id = s.id
group by s.id;

