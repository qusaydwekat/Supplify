-- Split retailer order updates: cancel from pending, confirm from modified (was only pending → any)
drop policy if exists "Retailers can update own pending orders" on public.orders;

create policy "Retailers can cancel own pending orders" on public.orders for update
  using (auth.uid() = retailer_id and status = 'pending')
  with check (auth.uid() = retailer_id and status = 'cancelled');

create policy "Retailers can confirm modified orders" on public.orders for update
  using (auth.uid() = retailer_id and status = 'modified')
  with check (auth.uid() = retailer_id and status = 'accepted');
