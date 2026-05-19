-- Allow suppliers to update any bank or branch row (including seed directory rows) so they can correct names, phones, etc.
-- Delete policies remain restricted to non-seed rows (033).

drop policy if exists "palestine_banks_update_custom" on public.palestine_banks;
drop policy if exists "palestine_bank_branches_update_custom" on public.palestine_bank_branches;

create policy "palestine_banks_update_supplier" on public.palestine_banks
  for update to authenticated
  using (exists (select 1 from public.suppliers s where s.user_id = auth.uid()))
  with check (exists (select 1 from public.suppliers s where s.user_id = auth.uid()));

create policy "palestine_bank_branches_update_supplier" on public.palestine_bank_branches
  for update to authenticated
  using (exists (select 1 from public.suppliers s where s.user_id = auth.uid()))
  with check (exists (select 1 from public.suppliers s where s.user_id = auth.uid()));
