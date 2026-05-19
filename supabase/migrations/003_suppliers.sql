create table public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade unique not null,
  description text,
  delivery_areas text[] default '{}',
  logo_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.suppliers enable row level security;

create policy "Suppliers are viewable by authenticated users" on public.suppliers for select to authenticated using (true);
create policy "Suppliers can insert own record" on public.suppliers for insert with check (auth.uid() = user_id);
create policy "Suppliers can update own record" on public.suppliers for update using (auth.uid() = user_id);

