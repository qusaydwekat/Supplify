-- Phase 3: installments, allocations, domain audit, RBAC scaffolding, inventory velocity MV, overdue reminders, partner statement RPC

-- ---------------------------------------------------------------------------
-- Installments & payment allocations
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_installments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  seq int not null check (seq >= 1),
  due_date timestamptz not null,
  amount_due numeric(12, 2) not null check (amount_due > 0),
  created_at timestamptz not null default now(),
  unique (invoice_id, seq)
);

create index idx_invoice_installments_invoice on public.invoice_installments (invoice_id);
create index idx_invoice_installments_due on public.invoice_installments (due_date);

create table if not exists public.payment_installment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  installment_id uuid not null references public.invoice_installments (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  unique (payment_id, installment_id)
);

create index idx_pay_inst_alloc_payment on public.payment_installment_allocations (payment_id);
create index idx_pay_inst_alloc_installment on public.payment_installment_allocations (installment_id);

alter table public.invoice_installments enable row level security;
alter table public.payment_installment_allocations enable row level security;

create policy "invoice_installments_participants"
  on public.invoice_installments for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_installments.invoice_id
        and (
          i.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = i.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

create policy "invoice_installments_supplier_write"
  on public.invoice_installments for all to authenticated
  using (
    exists (
      select 1 from public.invoices i
      join public.suppliers s on s.id = i.supplier_id
      where i.id = invoice_installments.invoice_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      join public.suppliers s on s.id = i.supplier_id
      where i.id = invoice_installments.invoice_id and s.user_id = auth.uid()
    )
  );

create policy "invoice_installments_admin"
  on public.invoice_installments for select to authenticated
  using (public.is_platform_admin());

create policy "pay_alloc_select"
  on public.payment_installment_allocations for select to authenticated
  using (
    exists (
      select 1 from public.payments p
      join public.invoices i on i.id = p.invoice_id
      where p.id = payment_installment_allocations.payment_id
        and (
          i.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = i.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

create policy "pay_alloc_supplier_insert"
  on public.payment_installment_allocations for insert to authenticated
  with check (
    exists (
      select 1 from public.payments p
      join public.invoices i on i.id = p.invoice_id
      join public.suppliers s on s.id = i.supplier_id
      where p.id = payment_installment_allocations.payment_id and s.user_id = auth.uid()
    )
  );

create policy "pay_alloc_admin"
  on public.payment_installment_allocations for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Domain audit (financial / inventory / RBAC events)
-- ---------------------------------------------------------------------------
create table if not exists public.domain_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_domain_audit_entity on public.domain_audit_events (entity_type, entity_id, created_at desc);
create index idx_domain_audit_actor on public.domain_audit_events (actor_id, created_at desc);

alter table public.domain_audit_events enable row level security;

drop policy if exists "domain_audit_insert_self" on public.domain_audit_events;
drop policy if exists "domain_audit_supplier_read" on public.domain_audit_events;
drop policy if exists "domain_audit_admin" on public.domain_audit_events;

create policy "domain_audit_insert_actor"
  on public.domain_audit_events for insert to authenticated
  with check (auth.uid() = actor_id);

create policy "domain_audit_select_actor_or_admin"
  on public.domain_audit_events for select to authenticated
  using (auth.uid() = actor_id or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- RBAC (platform admins)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles (id) on delete cascade,
  permission_id uuid not null references public.admin_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_admin_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.admin_roles (id) on delete cascade,
  primary key (user_id, role_id)
);

insert into public.admin_permissions (code, description) values
  ('finance.read', 'View financial configuration and currency settings'),
  ('finance.write', 'Modify FX and financial settings'),
  ('users.manage', 'Manage platform users'),
  ('catalog.manage', 'Manage banks and directory catalog'),
  ('support.read', 'Read-only operational visibility'),
  ('operations.full', 'Broad operational admin (non-financial)')
on conflict (code) do nothing;

insert into public.admin_roles (code, name) values
  ('finance_admin', 'Finance administrator'),
  ('support_admin', 'Support administrator'),
  ('operations_admin', 'Operations administrator')
on conflict (code) do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
cross join public.admin_permissions p
where r.code = 'finance_admin'
on conflict do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.code in ('support.read', 'catalog.manage')
where r.code = 'support_admin'
on conflict do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.code in ('operations.full', 'support.read')
where r.code = 'operations_admin'
on conflict do nothing;

alter table public.admin_permissions enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.user_admin_roles enable row level security;

create policy "admin_perm_read" on public.admin_permissions for select to authenticated using (public.is_platform_admin());
create policy "admin_roles_read" on public.admin_roles for select to authenticated using (public.is_platform_admin());
create policy "admin_rp_read" on public.admin_role_permissions for select to authenticated using (public.is_platform_admin());
create policy "user_admin_roles_read" on public.user_admin_roles for select to authenticated using (public.is_platform_admin());

create or replace function public.has_admin_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_admin_roles uar
    join public.admin_role_permissions arp on arp.role_id = uar.role_id
    join public.admin_permissions ap on ap.id = arp.permission_id
    where uar.user_id = auth.uid()
      and ap.code = p_code
  )
  or public.is_platform_admin();
$$;

grant execute on function public.has_admin_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Inventory velocity (rolling demand signal for reorder hints)
-- ---------------------------------------------------------------------------
create materialized view if not exists public.supplier_inventory_velocity_mv as
select
  m.supplier_id,
  m.product_variation_id,
  sum(case when m.type = 'sale'::public.inventory_movement_type then m.quantity else 0 end) as units_sold_30d,
  max(m.created_at) filter (where m.type = 'sale'::public.inventory_movement_type) as last_sale_at
from public.inventory_movements m
where m.created_at >= timezone('utc', now()) - interval '30 days'
group by m.supplier_id, m.product_variation_id;

create unique index if not exists idx_supplier_velocity_mv_pk on public.supplier_inventory_velocity_mv (supplier_id, product_variation_id);

create or replace function public.refresh_supplier_inventory_velocity_mv()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.supplier_inventory_velocity_mv;
exception
  when object_not_in_prerequisite_state then
    refresh materialized view public.supplier_inventory_velocity_mv;
end;
$$;

comment on function public.refresh_supplier_inventory_velocity_mv() is
  'Call from cron / Edge after sales activity; requires unique index on MV.';

-- ---------------------------------------------------------------------------
-- Overdue invoice reminders (batch-friendly)
-- ---------------------------------------------------------------------------
do $nt$
begin
  alter type public.notification_type add value 'overdue_invoice';
exception
  when duplicate_object then null;
end
$nt$;

create or replace function public.enqueue_overdue_invoice_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int := 0;
  r record;
begin
  for r in
    select distinct on (i.id)
      i.id as invoice_id,
      i.supplier_id,
      i.retailer_id,
      i.invoice_number,
      s.user_id as supplier_user_id,
      i.total - coalesce(pt.paid, 0) as open_amount
    from public.invoices i
    join public.suppliers s on s.id = i.supplier_id
    left join lateral (
      select sum(p.amount) as paid from public.payments p where p.invoice_id = i.id
    ) pt on true
    where i.due_date is not null
      and i.due_date < timezone('utc', now())
      and i.status in ('issued'::public.invoice_status, 'partial'::public.invoice_status, 'overdue'::public.invoice_status)
      and i.total > coalesce(pt.paid, 0)
      and not exists (
        select 1 from public.notifications n
        where n.reference_id = i.id
          and n.type = 'overdue_invoice'::public.notification_type
          and n.created_at > timezone('utc', now()) - interval '24 hours'
      )
  loop
    insert into public.notifications (user_id, type, title, message, reference_id, reference_type)
    values (
      r.supplier_user_id,
      'overdue_invoice'::public.notification_type,
      'Overdue invoice',
      'Invoice ' || r.invoice_number || ' has an open balance of ' || round(r.open_amount::numeric, 2)::text,
      r.invoice_id,
      'invoice'
    );
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

grant execute on function public.enqueue_overdue_invoice_reminders() to service_role;

revoke execute on function public.enqueue_overdue_invoice_reminders() from public;
revoke execute on function public.enqueue_overdue_invoice_reminders() from anon;
revoke execute on function public.enqueue_overdue_invoice_reminders() from authenticated;

-- ---------------------------------------------------------------------------
-- Partner account statement (running balance from legacy ledger)
-- ---------------------------------------------------------------------------
create or replace function public.supplier_partner_statement(
  p_supplier_id uuid,
  p_retailer_id uuid,
  p_from timestamptz default '-infinity'::timestamptz,
  p_to timestamptz default 'infinity'::timestamptz
)
returns table (
  line_ts timestamptz,
  entry_kind text,
  reference_id uuid,
  description text,
  debit numeric,
  credit numeric,
  running_balance numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_supplier_finance_access(p_supplier_id);

  if not public.is_platform_admin() then
    if auth.uid() <> p_retailer_id then
      if not exists (
        select 1 from public.suppliers s where s.id = p_supplier_id and s.user_id = auth.uid()
      ) then
        raise exception 'Forbidden';
      end if;
    end if;
  end if;

  return query
  with ordered as (
    select
      le.created_at as ts,
      le.type::text as k,
      le.reference_id as rid,
      coalesce(le.description, '') as descr,
      case when le.amount > 0 then le.amount else 0 end as dr,
      case when le.amount < 0 then -le.amount else 0 end as cr,
      sum(le.amount) over (order by le.created_at, le.id) as run_bal
    from public.ledger_entries le
    where le.supplier_id = p_supplier_id
      and le.retailer_id = p_retailer_id
      and le.created_at >= p_from
      and le.created_at < p_to
  )
  select ts, k, rid, descr, dr, cr, run_bal from ordered
  order by ts, rid;
end;
$$;

grant execute on function public.supplier_partner_statement(uuid, uuid, timestamptz, timestamptz) to authenticated;

-- Initial MV populate (non-concurrent safe at migration time)
refresh materialized view public.supplier_inventory_velocity_mv;
