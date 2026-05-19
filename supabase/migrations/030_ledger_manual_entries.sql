-- Expand ledger_entry_type enum for manual adjustments.
alter type ledger_entry_type add value if not exists 'credit_note';
alter type ledger_entry_type add value if not exists 'debit_note';

-- Notes table for ledger entries (ledger is append-only, so notes are separate).
create table if not exists public.ledger_entry_notes (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.ledger_entries(id) on delete cascade,
  note        text not null,
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint ledger_entry_notes_entry_unique unique (entry_id)
);

alter table public.ledger_entry_notes enable row level security;

create policy "Suppliers can manage notes on own ledger entries"
  on public.ledger_entry_notes for all
  using (
    entry_id in (
      select le.id from public.ledger_entries le
      join public.suppliers s on s.id = le.supplier_id
      where s.user_id = auth.uid()
    )
  );
