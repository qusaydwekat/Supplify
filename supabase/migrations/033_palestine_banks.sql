-- Palestine banks & branches directory (PMA-licensed institutions — seed data is illustrative;
-- suppliers can add banks/branches; seed rows are protected from edit/delete via RLS.)

create table public.palestine_banks (
  id uuid primary key default uuid_generate_v4(),
  name_en text not null,
  name_ar text,
  sort_order int not null default 0,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.palestine_bank_branches (
  id uuid primary key default uuid_generate_v4(),
  bank_id uuid not null references public.palestine_banks(id) on delete cascade,
  branch_number text not null,
  name_en text not null,
  name_ar text,
  city text,
  phone text,
  sort_order int not null default 0,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_id, branch_number)
);

comment on table public.palestine_banks is 'Banks operating in Palestine (seed + supplier-added).';
comment on table public.palestine_bank_branches is 'Branches with official-style branch numbers / phones where known.';
comment on column public.palestine_bank_branches.branch_number is 'Branch identifier as used on cheques / PMA listings (e.g. clearing code fragment).';
comment on column public.palestine_bank_branches.phone is 'Published branch phone(s); informational.';

alter table public.payments
  add column cheque_bank_branch_id uuid references public.palestine_bank_branches(id) on delete set null;

create index idx_palestine_bank_branches_bank_id on public.palestine_bank_branches(bank_id);
create index idx_payments_cheque_bank_branch_id on public.payments(cheque_bank_branch_id);

alter table public.palestine_banks enable row level security;
alter table public.palestine_bank_branches enable row level security;

-- Anyone signed in can read (invoice viewers need branch labels).
create policy "palestine_banks_select" on public.palestine_banks
  for select to authenticated using (true);

create policy "palestine_bank_branches_select" on public.palestine_bank_branches
  for select to authenticated using (true);

-- Suppliers maintain the directory.
create policy "palestine_banks_insert_supplier" on public.palestine_banks
  for insert to authenticated
  with check (exists (select 1 from public.suppliers s where s.user_id = auth.uid()));

create policy "palestine_banks_update_custom" on public.palestine_banks
  for update to authenticated
  using (
    is_seed = false
    and exists (select 1 from public.suppliers s where s.user_id = auth.uid())
  );

create policy "palestine_banks_delete_custom" on public.palestine_banks
  for delete to authenticated
  using (
    is_seed = false
    and exists (select 1 from public.suppliers s where s.user_id = auth.uid())
  );

create policy "palestine_bank_branches_insert_supplier" on public.palestine_bank_branches
  for insert to authenticated
  with check (exists (select 1 from public.suppliers s where s.user_id = auth.uid()));

create policy "palestine_bank_branches_update_custom" on public.palestine_bank_branches
  for update to authenticated
  using (
    is_seed = false
    and exists (select 1 from public.suppliers s where s.user_id = auth.uid())
  );

create policy "palestine_bank_branches_delete_custom" on public.palestine_bank_branches
  for delete to authenticated
  using (
    is_seed = false
    and exists (select 1 from public.suppliers s where s.user_id = auth.uid())
  );

grant select on public.palestine_banks to authenticated;
grant select on public.palestine_bank_branches to authenticated;
grant insert, update, delete on public.palestine_banks to authenticated;
grant insert, update, delete on public.palestine_bank_branches to authenticated;

-- Seed major PMA-sector banks (names from public PMA/banking-sector listings; branch rows are representative —
-- verify against PMA “Branches, Offices and ATMs” Excel for production.)

insert into public.palestine_banks (name_en, name_ar, sort_order, is_seed) values
('Bank of Palestine', 'بنك فلسطين', 10, true),
('Palestine Islamic Bank', 'البنك الإسلامي الفلسطيني', 20, true),
('Arab Bank plc', 'البنك العربي', 30, true),
('Jordan Kuwait Bank', 'بنك الأردن الكويت', 40, true),
('Cairo Amman Bank', 'بنك القاهرة عمان', 50, true),
('Arab Islamic Bank', 'البنك العربي الإسلامي', 60, true),
('Bank of Jordan', 'بنك الأردن', 70, true),
('Housing Bank for Trade and Finance', 'بنك الإسكان للتجارة والتمويل', 80, true),
('Palestine Investment Bank', 'بنك الاستثمار الفلسطيني', 90, true),
('Al Quds Bank', 'بنك القدس', 100, true),
('The National Bank', 'البنك الوطني', 110, true),
('Safa Bank', 'بنك صفا', 120, true);

-- Branches: illustrative branch_number + city; phones are placeholders — replace from PMA directory as needed.
insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah — Main', 'رام الله — الرئيسي', 'Ramallah', '+970 2 296 2500', 1, true from public.palestine_banks where name_en = 'Bank of Palestine'
union all select id, '002', 'Gaza — Omar al-Mukhtar', 'غزة — عمر المختار', 'Gaza', '+970 8 282 7000', 2, true from public.palestine_banks where name_en = 'Bank of Palestine'
union all select id, '003', 'Nablus — Downtown', 'نابلس — المركز', 'Nablus', '+970 9 234 1111', 3, true from public.palestine_banks where name_en = 'Bank of Palestine'
union all select id, '004', 'Hebron — City', 'الخليل — المدينة', 'Hebron', '+970 2 222 0333', 4, true from public.palestine_banks where name_en = 'Bank of Palestine';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah — Main', 'رام الله — الرئيسي', 'Ramallah', '+970 2 297 8200', 1, true from public.palestine_banks where name_en = 'Palestine Islamic Bank'
union all select id, '002', 'Gaza — Main', 'غزة — الرئيسي', 'Gaza', '+970 8 282 8400', 2, true from public.palestine_banks where name_en = 'Palestine Islamic Bank'
union all select id, '003', 'Nablus', 'نابلس', 'Nablus', '+970 9 238 2200', 3, true from public.palestine_banks where name_en = 'Palestine Islamic Bank'
union all select id, '004', 'Bethlehem', 'بيت لحم', 'Bethlehem', '+970 2 274 4400', 4, true from public.palestine_banks where name_en = 'Palestine Islamic Bank';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah — HQ area', 'رام الله', 'Ramallah', '+970 2 295 5111', 1, true from public.palestine_banks where name_en = 'Arab Bank plc'
union all select id, '002', 'Gaza', 'غزة', 'Gaza', '+970 8 282 6111', 2, true from public.palestine_banks where name_en = 'Arab Bank plc'
union all select id, '003', 'Nablus', 'نابلس', 'Nablus', '+970 9 234 5111', 3, true from public.palestine_banks where name_en = 'Arab Bank plc'
union all select id, '004', 'Jenin', 'جنين', 'Jenin', '+970 4 240 2111', 4, true from public.palestine_banks where name_en = 'Arab Bank plc';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 298 1111', 1, true from public.palestine_banks where name_en = 'Jordan Kuwait Bank'
union all select id, '002', 'Al-Bireh', 'البيرة', 'Al-Bireh', '+970 2 276 3222', 2, true from public.palestine_banks where name_en = 'Jordan Kuwait Bank'
union all select id, '003', 'Nablus', 'نابلس', 'Nablus', '+970 9 234 8222', 3, true from public.palestine_banks where name_en = 'Jordan Kuwait Bank'
union all select id, '004', 'Hebron', 'الخليل', 'Hebron', '+970 2 222 9222', 4, true from public.palestine_banks where name_en = 'Jordan Kuwait Bank';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 295 0333', 1, true from public.palestine_banks where name_en = 'Cairo Amman Bank'
union all select id, '002', 'Gaza', 'غزة', 'Gaza', '+970 8 282 4333', 2, true from public.palestine_banks where name_en = 'Cairo Amman Bank'
union all select id, '003', 'Nablus', 'نابلس', 'Nablus', '+970 9 234 4333', 3, true from public.palestine_banks where name_en = 'Cairo Amman Bank';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 297 2111', 1, true from public.palestine_banks where name_en = 'Arab Islamic Bank'
union all select id, '002', 'Gaza', 'غزة', 'Gaza', '+970 8 282 5111', 2, true from public.palestine_banks where name_en = 'Arab Islamic Bank'
union all select id, '003', 'Hebron', 'الخليل', 'Hebron', '+970 2 222 7111', 3, true from public.palestine_banks where name_en = 'Arab Islamic Bank';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 298 0444', 1, true from public.palestine_banks where name_en = 'Bank of Jordan'
union all select id, '002', 'Nablus', 'نابلس', 'Nablus', '+970 9 234 0444', 2, true from public.palestine_banks where name_en = 'Bank of Jordan'
union all select id, '003', 'Jenin', 'جنين', 'Jenin', '+970 4 240 0444', 3, true from public.palestine_banks where name_en = 'Bank of Jordan';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah — Main', 'رام الله', 'Ramallah', '+970 2 294 8222', 1, true from public.palestine_banks where name_en = 'Housing Bank for Trade and Finance'
union all select id, '002', 'Gaza', 'غزة', 'Gaza', '+970 8 282 9222', 2, true from public.palestine_banks where name_en = 'Housing Bank for Trade and Finance'
union all select id, '003', 'Tulkarm', 'طولكرم', 'Tulkarm', '+970 9 267 3222', 3, true from public.palestine_banks where name_en = 'Housing Bank for Trade and Finance';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 296 9900', 1, true from public.palestine_banks where name_en = 'Palestine Investment Bank'
union all select id, '002', 'Gaza', 'غزة', 'Gaza', '+970 8 282 9900', 2, true from public.palestine_banks where name_en = 'Palestine Investment Bank'
union all select id, '003', 'Nablus', 'نابلس', 'Nablus', '+970 9 234 9900', 3, true from public.palestine_banks where name_en = 'Palestine Investment Bank';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 297 3100', 1, true from public.palestine_banks where name_en = 'Al Quds Bank'
union all select id, '002', 'Gaza', 'غزة', 'Gaza', '+970 8 282 3100', 2, true from public.palestine_banks where name_en = 'Al Quds Bank'
union all select id, '003', 'Bethlehem', 'بيت لحم', 'Bethlehem', '+970 2 274 3100', 3, true from public.palestine_banks where name_en = 'Al Quds Bank';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 295 7700', 1, true from public.palestine_banks where name_en = 'The National Bank'
union all select id, '002', 'Nablus', 'نابلس', 'Nablus', '+970 9 234 7700', 2, true from public.palestine_banks where name_en = 'The National Bank'
union all select id, '003', 'Jericho', 'أريحا', 'Jericho', '+970 2 232 7700', 3, true from public.palestine_banks where name_en = 'The National Bank';

insert into public.palestine_bank_branches (bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed)
select id, '001', 'Ramallah', 'رام الله', 'Ramallah', '+970 2 296 6600', 1, true from public.palestine_banks where name_en = 'Safa Bank'
union all select id, '002', 'Gaza', 'غزة', 'Gaza', '+970 8 282 6600', 2, true from public.palestine_banks where name_en = 'Safa Bank';
