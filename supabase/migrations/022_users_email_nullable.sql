-- Retailers may omit email (phone is primary in auth); suppliers must keep email.
alter table public.users alter column email drop not null;

alter table public.users add constraint users_supplier_requires_email
  check (role <> 'supplier' or email is not null);
