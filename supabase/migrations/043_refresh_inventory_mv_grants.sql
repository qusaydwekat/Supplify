-- Refresh MV is triggered by cron (service role); lock down public execution like other batch RPCs

grant execute on function public.refresh_supplier_inventory_velocity_mv() to service_role;

revoke execute on function public.refresh_supplier_inventory_velocity_mv() from public;
revoke execute on function public.refresh_supplier_inventory_velocity_mv() from anon;
revoke execute on function public.refresh_supplier_inventory_velocity_mv() from authenticated;
