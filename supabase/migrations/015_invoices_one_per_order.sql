-- One final invoice per order (MVP); prevents duplicate billing for the same fulfilment.
create unique index idx_invoices_unique_order on public.invoices (order_id);
