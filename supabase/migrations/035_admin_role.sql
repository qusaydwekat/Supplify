-- Platform administrator role (promote users in SQL or via Admin → Users after first admin exists)

do $admin_enum$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role' and e.enumlabel = 'admin'
  ) then
    alter type public.user_role add value 'admin';
  end if;
end
$admin_enum$;

comment on type public.user_role is 'Application role: supplier, retailer, or admin (full platform access).';
