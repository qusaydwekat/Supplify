-- Manual ledger entries (credit_note / debit_note) may be updated or deleted by suppliers.
-- System-generated invoice and payment lines remain append-only via trigger.

drop rule if exists no_update_ledger on public.ledger_entries;
drop rule if exists no_delete_ledger on public.ledger_entries;

create or replace function public.enforce_ledger_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.type::text not in ('credit_note', 'debit_note') then
      raise exception 'Ledger entries of type % cannot be updated', old.type;
    end if;
    if new.type is distinct from old.type then
      raise exception 'Cannot change ledger entry type';
    end if;
    if new.supplier_id is distinct from old.supplier_id then
      raise exception 'Cannot change ledger supplier';
    end if;
    if new.reference_id is distinct from old.reference_id then
      raise exception 'Cannot change ledger reference';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.type::text not in ('credit_note', 'debit_note') then
      raise exception 'Ledger entries of type % cannot be deleted', old.type;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_ledger_append_only on public.ledger_entries;
create trigger trg_ledger_append_only
  before update or delete on public.ledger_entries
  for each row
  execute function public.enforce_ledger_append_only();

create policy "Suppliers can update manual ledger entries"
  on public.ledger_entries for update to authenticated
  using (
    type in ('credit_note'::public.ledger_entry_type, 'debit_note'::public.ledger_entry_type)
    and exists (
      select 1 from public.suppliers s
      where s.id = ledger_entries.supplier_id and s.user_id = auth.uid()
    )
  )
  with check (
    type in ('credit_note'::public.ledger_entry_type, 'debit_note'::public.ledger_entry_type)
    and exists (
      select 1 from public.suppliers s
      where s.id = ledger_entries.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "Suppliers can delete manual ledger entries"
  on public.ledger_entries for delete to authenticated
  using (
    type in ('credit_note'::public.ledger_entry_type, 'debit_note'::public.ledger_entry_type)
    and exists (
      select 1 from public.suppliers s
      where s.id = ledger_entries.supplier_id and s.user_id = auth.uid()
    )
  );
