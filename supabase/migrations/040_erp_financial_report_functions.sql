-- Financial reporting RPCs (SQL-side aggregation). Uses SECURITY DEFINER + supplier ownership checks.

create or replace function public.assert_supplier_finance_access(p_supplier_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return;
  end if;
  if not exists (
    select 1 from public.suppliers s
    where s.id = p_supplier_id and s.user_id = auth.uid()
  ) then
    raise exception 'Forbidden';
  end if;
end;
$$;

grant execute on function public.assert_supplier_finance_access(uuid) to authenticated;

create or replace function public.supplier_trial_balance(
  p_supplier_id uuid,
  p_from timestamptz default '-infinity'::timestamptz,
  p_to timestamptz default 'infinity'::timestamptz
)
returns table (
  account_code text,
  account_name text,
  account_type public.coa_account_type,
  total_debit numeric,
  total_credit numeric,
  net_balance numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_supplier_finance_access(p_supplier_id);

  return query
  select
    co.code,
    co.name,
    co.type,
    round(sum(jl.debit)::numeric, 2),
    round(sum(jl.credit)::numeric, 2),
    round(sum(jl.debit - jl.credit)::numeric, 2)
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id
    and je.posted_at >= p_from
    and je.posted_at < p_to
  group by co.id, co.code, co.name, co.type
  order by co.code;
end;
$$;

grant execute on function public.supplier_trial_balance(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.supplier_profit_and_loss(
  p_supplier_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  revenue numeric,
  cost_of_goods_sold numeric,
  operating_expenses numeric,
  gross_profit numeric,
  net_operating_income numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rev numeric;
  v_cogs numeric;
  v_opex numeric;
begin
  perform public.assert_supplier_finance_access(p_supplier_id);

  select coalesce(round(sum(case when co.code = '4000' then jl.credit - jl.debit else 0 end)::numeric, 2), 0)
  into v_rev
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id
    and je.posted_at >= p_from
    and je.posted_at < p_to;

  select coalesce(round(sum(case when co.code = '5000' then jl.debit - jl.credit else 0 end)::numeric, 2), 0)
  into v_cogs
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id
    and je.posted_at >= p_from
    and je.posted_at < p_to;

  select coalesce(round(sum(case when co.code = '5100' then jl.debit - jl.credit else 0 end)::numeric, 2), 0)
  into v_opex
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id
    and je.posted_at >= p_from
    and je.posted_at < p_to;

  return query
  select
    v_rev,
    v_cogs,
    v_opex,
    round((v_rev - v_cogs)::numeric, 2),
    round((v_rev - v_cogs - v_opex)::numeric, 2);
end;
$$;

grant execute on function public.supplier_profit_and_loss(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.supplier_balance_sheet_snapshot(p_supplier_id uuid)
returns table (
  total_assets numeric,
  total_liabilities numeric,
  total_equity numeric,
  retained_earnings numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_assets numeric;
  v_liab numeric;
  v_equity numeric;
  v_rev_exp numeric;
begin
  perform public.assert_supplier_finance_access(p_supplier_id);

  select coalesce(round(sum(case when co.type = 'asset'::public.coa_account_type then jl.debit - jl.credit else 0 end)::numeric, 2), 0)
  into v_assets
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id;

  select coalesce(round(sum(case when co.type = 'liability'::public.coa_account_type then jl.credit - jl.debit else 0 end)::numeric, 2), 0)
  into v_liab
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id;

  select coalesce(round(sum(case when co.type = 'equity'::public.coa_account_type then jl.credit - jl.debit else 0 end)::numeric, 2), 0)
  into v_equity
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id;

  select coalesce(round(sum(case when co.type = 'revenue'::public.coa_account_type then jl.credit - jl.debit else 0 end)::numeric, 2), 0)
    - coalesce(round(sum(case when co.type = 'expense'::public.coa_account_type then jl.debit - jl.credit else 0 end)::numeric, 2), 0)
  into v_rev_exp
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts co on co.id = jl.account_id
  where je.supplier_id = p_supplier_id;

  return query select v_assets, v_liab, v_equity, v_rev_exp;
end;
$$;

grant execute on function public.supplier_balance_sheet_snapshot(uuid) to authenticated;

create or replace function public.supplier_cash_flow_summary(
  p_supplier_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  cash_in numeric,
  cash_out numeric,
  net_change numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cash_id uuid;
  cin numeric;
  cout numeric;
begin
  perform public.assert_supplier_finance_access(p_supplier_id);

  select public.coa_account_id(p_supplier_id, '1000') into cash_id;
  if cash_id is null then
    return query select 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  select coalesce(round(sum(case when jl.debit > 0 then jl.debit else 0 end)::numeric, 2), 0)
  into cin
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  where jl.account_id = cash_id
    and je.supplier_id = p_supplier_id
    and je.posted_at >= p_from
    and je.posted_at < p_to;

  select coalesce(round(sum(case when jl.credit > 0 then jl.credit else 0 end)::numeric, 2), 0)
  into cout
  from public.journal_entry_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  where jl.account_id = cash_id
    and je.supplier_id = p_supplier_id
    and je.posted_at >= p_from
    and je.posted_at < p_to;

  return query select cin, cout, round((cin - cout)::numeric, 2);
end;
$$;

grant execute on function public.supplier_cash_flow_summary(uuid, timestamptz, timestamptz) to authenticated;

-- Compare legacy partner ledger sum vs journal AR + Revenue-derived sanity (informational)
create or replace function public.supplier_ledger_journal_totals(p_supplier_id uuid)
returns table (
  ledger_net numeric,
  journal_ar_net numeric,
  journal_revenue_net numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ar_id uuid;
  rev_id uuid;
  v_ledger numeric;
  v_ar numeric;
  v_rev numeric;
begin
  perform public.assert_supplier_finance_access(p_supplier_id);

  select round(sum(le.amount)::numeric, 2)
  into v_ledger
  from public.ledger_entries le
  where le.supplier_id = p_supplier_id;

  select public.coa_account_id(p_supplier_id, '1100') into ar_id;
  select public.coa_account_id(p_supplier_id, '4000') into rev_id;

  if ar_id is not null then
    select coalesce(round(sum(jl.debit - jl.credit)::numeric, 2), 0)
    into v_ar
    from public.journal_entry_lines jl
    join public.journal_entries je on je.id = jl.journal_entry_id
    where jl.account_id = ar_id and je.supplier_id = p_supplier_id;
  else
    v_ar := 0;
  end if;

  if rev_id is not null then
    select coalesce(round(sum(jl.credit - jl.debit)::numeric, 2), 0)
    into v_rev
    from public.journal_entry_lines jl
    join public.journal_entries je on je.id = jl.journal_entry_id
    where jl.account_id = rev_id and je.supplier_id = p_supplier_id;
  else
    v_rev := 0;
  end if;

  return query select v_ledger, v_ar, v_rev;
end;
$$;

grant execute on function public.supplier_ledger_journal_totals(uuid) to authenticated;
