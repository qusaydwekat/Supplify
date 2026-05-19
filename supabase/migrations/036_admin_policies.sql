-- RLS: administrators can manage directory data, users, FX settings, and read audit trail.
-- Uses SECURITY DEFINER helper so policies on public.users do not recurse.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'::public.user_role
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

create policy "users_select_admin" on public.users
  for select to authenticated
  using (public.is_platform_admin());

create policy "users_update_admin" on public.users
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "palestine_banks_admin_all" on public.palestine_banks
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "palestine_bank_branches_admin_all" on public.palestine_bank_branches
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "app_settings_admin_update" on public.app_settings
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "currency_rates_admin_all" on public.currency_rates
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "suppliers_select_admin" on public.suppliers
  for select to authenticated
  using (public.is_platform_admin());

create policy "suppliers_insert_admin" on public.suppliers
  for insert to authenticated
  with check (public.is_platform_admin());

create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated
  using (public.is_platform_admin());

create policy "orders_select_admin" on public.orders
  for select to authenticated
  using (public.is_platform_admin());

create policy "invoices_select_admin" on public.invoices
  for select to authenticated
  using (public.is_platform_admin());

create policy "products_select_admin" on public.products
  for select to authenticated
  using (public.is_platform_admin());
