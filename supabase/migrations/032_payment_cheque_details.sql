-- Structured cheque metadata (required at application layer when method = cheque)
alter table public.payments
  add column cheque_number text,
  add column cheque_bank_name text,
  add column cheque_branch text,
  add column cheque_date date;

comment on column public.payments.cheque_number is 'Cheque serial / number as printed on the cheque.';
comment on column public.payments.cheque_bank_name is 'Issuing bank name.';
comment on column public.payments.cheque_branch is 'Bank branch (code or name).';
comment on column public.payments.cheque_date is 'Date written on the cheque.';
