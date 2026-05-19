-- Phase 4 polish: inventory MV visibility for authenticated suppliers, seed RBAC links for platform admins

grant select on public.supplier_inventory_velocity_mv to authenticated;

insert into public.user_admin_roles (user_id, role_id)
select u.id, r.id
from public.users u
cross join public.admin_roles r
where u.role = 'admin'
  and r.code = 'finance_admin'
on conflict do nothing;
