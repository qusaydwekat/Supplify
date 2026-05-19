-- Allow suppliers to update/delete order line items for orders in their store (modify-order flow)
create policy "Suppliers can update order items for their orders" on public.order_items for update using (
  exists (
    select 1 from public.orders o
    join public.suppliers s on s.id = o.supplier_id
    where o.id = order_items.order_id and s.user_id = auth.uid()
  )
);

create policy "Suppliers can delete order items for their orders" on public.order_items for delete using (
  exists (
    select 1 from public.orders o
    join public.suppliers s on s.id = o.supplier_id
    where o.id = order_items.order_id and s.user_id = auth.uid()
  )
);
