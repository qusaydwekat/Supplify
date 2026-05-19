-- Phase 2: supplier-scoped chart of accounts, balanced journal entries, FX snapshots (immutable columns)

do $at$
begin
  if not exists (select 1 from pg_type where typname = 'coa_account_type') then
    create type public.coa_account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
  end if;
end
$at$;

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  code text not null,
  name text not null,
  type public.coa_account_type not null,
  is_system boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  unique (supplier_id, code)
);

create index idx_coa_supplier on public.chart_of_accounts (supplier_id);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  retailer_id uuid references public.users (id) on delete set null,
  reference_type text not null,
  reference_id uuid not null,
  description text,
  fx_snapshot jsonb,
  posted_at timestamptz not null default now(),
  reverses_journal_id uuid references public.journal_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (supplier_id, reference_type, reference_id)
);

create index idx_journal_supplier_posted on public.journal_entries (supplier_id, posted_at desc);
create index idx_journal_reference on public.journal_entries (reference_type, reference_id);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts (id) on delete restrict,
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  constraint journal_line_one_side_positive check (
    (debit > 0 and credit = 0)
    or (credit > 0 and debit = 0)
  )
);

create index idx_journal_lines_entry on public.journal_entry_lines (journal_entry_id);

create or replace function public.validate_journal_entry_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
  sdebit numeric;
  scredit numeric;
begin
  jid := coalesce(NEW.journal_entry_id, OLD.journal_entry_id);
  if jid is null then
    return null;
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  into sdebit, scredit
  from public.journal_entry_lines
  where journal_entry_id = jid;

  if sdebit <> scredit then
    raise exception 'Journal % not balanced (debits % credits %)', jid, sdebit, scredit;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_journal_lines_balance on public.journal_entry_lines;
create constraint trigger trg_journal_lines_balance
  after insert or update or delete on public.journal_entry_lines
  deferrable initially deferred
  for each row execute function public.validate_journal_entry_balance();

-- FX snapshots on financial documents (immutable — updated only via migrations/corrections with reversing journals)
alter table public.invoices add column if not exists fx_snapshot jsonb;
alter table public.payments add column if not exists fx_snapshot jsonb;

comment on column public.invoices.fx_snapshot is 'Immutable FX context at issuance for historical reporting.';
comment on column public.payments.fx_snapshot is 'Immutable FX context when payment was recorded.';
comment on column public.journal_entries.fx_snapshot is 'FX context for this journal header.';

-- Seed chart of accounts for every supplier (idempotent)
insert into public.chart_of_accounts (supplier_id, code, name, type, sort_order)
select s.id, v.code, v.name, v.t::public.coa_account_type, v.ord
from public.suppliers s
cross join (
  values
    ('1000', 'Cash', 'asset'::public.coa_account_type, 10),
    ('1100', 'Accounts Receivable', 'asset'::public.coa_account_type, 20),
    ('1200', 'Inventory', 'asset'::public.coa_account_type, 30),
    ('4000', 'Sales Revenue', 'revenue'::public.coa_account_type, 40),
    ('5000', 'Cost of Goods Sold', 'expense'::public.coa_account_type, 50),
    ('5100', 'Operating Expenses', 'expense'::public.coa_account_type, 60)
) as v(code, name, t, ord)
on conflict (supplier_id, code) do nothing;

create or replace function public.coa_account_id(p_supplier_id uuid, p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.chart_of_accounts
  where supplier_id = p_supplier_id and code = p_code
  limit 1;
$$;

grant execute on function public.coa_account_id(uuid, text) to authenticated;

create or replace function public.capture_invoice_fx_snapshot(p_invoice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  inv record;
  mult numeric;
  defcur text;
begin
  select i.currency_code, i.total into inv
  from public.invoices i where i.id = p_invoice_id;

  select default_currency into defcur from public.app_settings where id = 1;
  select cr.to_default_multiplier into mult
  from public.currency_rates cr
  where upper(trim(cr.currency_code::text)) = upper(trim(inv.currency_code));

  return jsonb_build_object(
    'default_currency', coalesce(defcur, 'USD'),
    'invoice_currency', inv.currency_code,
    'invoice_total', inv.total,
    'to_default_multiplier', coalesce(mult, 1),
    'captured_at', timezone('utc', now())
  );
end;
$$;

create or replace function public.set_invoice_fx_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mult numeric;
  defcur text;
begin
  select default_currency into defcur from public.app_settings where id = 1;
  select cr.to_default_multiplier into mult
  from public.currency_rates cr
  where upper(trim(cr.currency_code::text)) = upper(trim(NEW.currency_code));

  NEW.fx_snapshot := jsonb_build_object(
    'default_currency', coalesce(defcur, 'USD'),
    'invoice_currency', NEW.currency_code,
    'invoice_total', NEW.total,
    'to_default_multiplier', coalesce(mult, 1),
    'captured_at', timezone('utc', now())
  );
  return NEW;
end;
$$;

drop trigger if exists trg_invoice_fx_snapshot on public.invoices;
create trigger trg_invoice_fx_snapshot
  before insert on public.invoices
  for each row execute function public.set_invoice_fx_snapshot();

create or replace function public.capture_payment_fx_snapshot(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pay record;
  inv record;
  mult numeric;
  defcur text;
begin
  select p.amount, p.payment_currency, p.payment_amount, p.amount_in_default_currency, p.invoice_id into pay
  from public.payments p where p.id = p_payment_id;

  select i.currency_code into inv from public.invoices i where i.id = pay.invoice_id;

  select default_currency into defcur from public.app_settings where id = 1;
  select cr.to_default_multiplier into mult
  from public.currency_rates cr
  where upper(trim(cr.currency_code::text)) = upper(trim(pay.payment_currency));

  return jsonb_build_object(
    'default_currency', coalesce(defcur, 'USD'),
    'payment_currency', pay.payment_currency,
    'payment_amount', pay.payment_amount,
    'amount_in_default_currency', pay.amount_in_default_currency,
    'to_default_multiplier', coalesce(mult, 1),
    'invoice_currency', inv.currency_code,
    'captured_at', timezone('utc', now())
  );
end;
$$;

create or replace function public.set_payment_fx_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_currency text;
  mult numeric;
  defcur text;
begin
  select i.currency_code into inv_currency from public.invoices i where i.id = NEW.invoice_id;

  select default_currency into defcur from public.app_settings where id = 1;
  select cr.to_default_multiplier into mult
  from public.currency_rates cr
  where upper(trim(cr.currency_code::text)) = upper(trim(NEW.payment_currency));

  NEW.fx_snapshot := jsonb_build_object(
    'default_currency', coalesce(defcur, 'USD'),
    'payment_currency', NEW.payment_currency,
    'payment_amount', NEW.payment_amount,
    'amount_in_default_currency', NEW.amount_in_default_currency,
    'amount_applied_to_invoice', NEW.amount,
    'to_default_multiplier', coalesce(mult, 1),
    'invoice_currency', inv_currency,
    'captured_at', timezone('utc', now())
  );
  return NEW;
end;
$$;

drop trigger if exists trg_payment_fx_snapshot on public.payments;
create trigger trg_payment_fx_snapshot
  before insert on public.payments
  for each row execute function public.set_payment_fx_snapshot();

create or replace function public.post_journal_from_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
  ar_id uuid;
  rev_id uuid;
  fx jsonb;
begin
  ar_id := public.coa_account_id(NEW.supplier_id, '1100');
  rev_id := public.coa_account_id(NEW.supplier_id, '4000');
  if ar_id is null or rev_id is null then
    raise exception 'Chart of accounts not seeded for supplier %', NEW.supplier_id;
  end if;

  fx := coalesce(NEW.fx_snapshot, public.capture_invoice_fx_snapshot(NEW.id));

  insert into public.journal_entries (supplier_id, retailer_id, reference_type, reference_id, description, fx_snapshot)
  values (
    NEW.supplier_id,
    NEW.retailer_id,
    'invoice',
    NEW.id,
    'Invoice ' || NEW.invoice_number,
    fx
  )
  on conflict (supplier_id, reference_type, reference_id) do nothing
  returning id into jid;

  if jid is null then
    select je.id into jid from public.journal_entries je
    where je.supplier_id = NEW.supplier_id and je.reference_type = 'invoice' and je.reference_id = NEW.id;
  end if;

  delete from public.journal_entry_lines where journal_entry_id = jid;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit)
  values
    (jid, ar_id, NEW.total, 0),
    (jid, rev_id, 0, NEW.total);

  return NEW;
end;
$$;

drop trigger if exists trg_invoice_journal on public.invoices;
create trigger trg_invoice_journal
  after insert on public.invoices
  for each row execute function public.post_journal_from_invoice();

create or replace function public.post_journal_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
  cash_id uuid;
  ar_id uuid;
  inv record;
  fx jsonb;
begin
  select supplier_id, retailer_id, currency_code into inv from public.invoices where id = NEW.invoice_id;
  if inv.supplier_id is null then
    raise exception 'Invoice not found for payment';
  end if;

  cash_id := public.coa_account_id(inv.supplier_id, '1000');
  ar_id := public.coa_account_id(inv.supplier_id, '1100');
  if cash_id is null or ar_id is null then
    raise exception 'Chart of accounts not seeded for supplier %', inv.supplier_id;
  end if;

  fx := coalesce(NEW.fx_snapshot, public.capture_payment_fx_snapshot(NEW.id));

  insert into public.journal_entries (supplier_id, retailer_id, reference_type, reference_id, description, fx_snapshot)
  values (
    inv.supplier_id,
    inv.retailer_id,
    'payment',
    NEW.id,
    'Payment allocation',
    fx
  )
  on conflict (supplier_id, reference_type, reference_id) do nothing
  returning id into jid;

  if jid is null then
    select je.id into jid from public.journal_entries je
    where je.supplier_id = inv.supplier_id and je.reference_type = 'payment' and je.reference_id = NEW.id;
  end if;

  delete from public.journal_entry_lines where journal_entry_id = jid;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit)
  values
    (jid, cash_id, NEW.amount, 0),
    (jid, ar_id, 0, NEW.amount);

  return NEW;
end;
$$;

drop trigger if exists trg_payment_journal on public.payments;
create trigger trg_payment_journal
  after insert on public.payments
  for each row execute function public.post_journal_from_payment();

create or replace function public.post_journal_from_inventory_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
  cogs_id uuid;
  inv_asset_id uuid;
  line_amount numeric(14, 2);
  v_supplier_id uuid;
  fx jsonb;
begin
  if NEW.type <> 'sale'::public.inventory_movement_type or NEW.reference_type <> 'order_item' then
    return NEW;
  end if;

  select oi.quantity * coalesce(oi.unit_cost_price, 0), o.supplier_id
  into line_amount, v_supplier_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = NEW.reference_id;

  if line_amount is null or line_amount <= 0 then
    return NEW;
  end if;

  cogs_id := public.coa_account_id(v_supplier_id, '5000');
  inv_asset_id := public.coa_account_id(v_supplier_id, '1200');
  if cogs_id is null or inv_asset_id is null then
    raise exception 'Chart of accounts not seeded';
  end if;

  fx := jsonb_build_object(
    'movement_id', NEW.id,
    'order_item_id', NEW.reference_id,
    'captured_at', timezone('utc', now())
  );

  insert into public.journal_entries (supplier_id, retailer_id, reference_type, reference_id, description, fx_snapshot)
  values (
    v_supplier_id,
    null,
    'cogs_sale',
    NEW.id,
    'COGS — inventory sale',
    fx
  )
  on conflict (supplier_id, reference_type, reference_id) do nothing
  returning id into jid;

  if jid is null then
    select je.id into jid from public.journal_entries je
    where je.supplier_id = v_supplier_id and je.reference_type = 'cogs_sale' and je.reference_id = NEW.id;
  end if;

  delete from public.journal_entry_lines where journal_entry_id = jid;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit)
  values
    (jid, cogs_id, line_amount, 0),
    (jid, inv_asset_id, 0, line_amount);

  return NEW;
end;
$$;

drop trigger if exists trg_inventory_sale_journal on public.inventory_movements;
create trigger trg_inventory_sale_journal
  after insert on public.inventory_movements
  for each row execute function public.post_journal_from_inventory_sale();

create or replace function public.post_journal_from_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
  exp_id uuid;
  cash_id uuid;
  fx jsonb;
begin
  exp_id := public.coa_account_id(NEW.supplier_id, '5100');
  cash_id := public.coa_account_id(NEW.supplier_id, '1000');
  if exp_id is null or cash_id is null then
    raise exception 'Chart of accounts not seeded';
  end if;

  fx := jsonb_build_object(
    'expense_id', NEW.id,
    'currency', NEW.currency_code,
    'captured_at', timezone('utc', now())
  );

  insert into public.journal_entries (supplier_id, retailer_id, reference_type, reference_id, description, fx_snapshot)
  values (
    NEW.supplier_id,
    null,
    'expense',
    NEW.id,
    coalesce(NEW.description, 'Expense'),
    fx
  )
  on conflict (supplier_id, reference_type, reference_id) do nothing
  returning id into jid;

  if jid is null then
    select je.id into jid from public.journal_entries je
    where je.supplier_id = NEW.supplier_id and je.reference_type = 'expense' and je.reference_id = NEW.id;
  end if;

  delete from public.journal_entry_lines where journal_entry_id = jid;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit)
  values
    (jid, exp_id, NEW.amount, 0),
    (jid, cash_id, 0, NEW.amount);

  return NEW;
end;
$$;

drop trigger if exists trg_expense_journal on public.expenses;
create trigger trg_expense_journal
  after insert on public.expenses
  for each row execute function public.post_journal_from_expense();

alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;

create policy "coa_supplier_select" on public.chart_of_accounts for select to authenticated
  using (exists (select 1 from public.suppliers s where s.id = chart_of_accounts.supplier_id and s.user_id = auth.uid()));

create policy "coa_admin_select" on public.chart_of_accounts for select to authenticated
  using (public.is_platform_admin());

create policy "journal_supplier_select" on public.journal_entries for select to authenticated
  using (exists (select 1 from public.suppliers s where s.id = journal_entries.supplier_id and s.user_id = auth.uid()));

create policy "journal_admin_select" on public.journal_entries for select to authenticated
  using (public.is_platform_admin());

create policy "journal_lines_supplier_select" on public.journal_entry_lines for select to authenticated
  using (
    exists (
      select 1 from public.journal_entries je
      join public.suppliers s on s.id = je.supplier_id
      where je.id = journal_entry_lines.journal_entry_id and s.user_id = auth.uid()
    )
  );

create policy "journal_lines_admin_select" on public.journal_entry_lines for select to authenticated
  using (public.is_platform_admin());

-- Seed chart of accounts when a new supplier registers
create or replace function public.seed_supplier_coa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chart_of_accounts (supplier_id, code, name, type, sort_order)
  select NEW.id, v.code, v.name, v.t::public.coa_account_type, v.ord
  from (
    values
      ('1000', 'Cash', 'asset'::public.coa_account_type, 10),
      ('1100', 'Accounts Receivable', 'asset'::public.coa_account_type, 20),
      ('1200', 'Inventory', 'asset'::public.coa_account_type, 30),
      ('4000', 'Sales Revenue', 'revenue'::public.coa_account_type, 40),
      ('5000', 'Cost of Goods Sold', 'expense'::public.coa_account_type, 50),
      ('5100', 'Operating Expenses', 'expense'::public.coa_account_type, 60)
  ) as v(code, name, t, ord)
  on conflict (supplier_id, code) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_supplier_seed_coa on public.suppliers;
create trigger trg_supplier_seed_coa
  after insert on public.suppliers
  for each row execute function public.seed_supplier_coa();
