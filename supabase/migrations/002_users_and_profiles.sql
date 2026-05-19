create type user_role as enum ('supplier', 'retailer');

create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  role user_role not null,
  created_at timestamptz default now()
);

create table public.profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade unique not null,
  name text not null,
  phone text,
  business_name text not null,
  city text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.profiles enable row level security;

create policy "Users can view own user record" on public.users for select using (auth.uid() = id);
create policy "Users can update own user record" on public.users for update using (auth.uid() = id);

create policy "Profiles are viewable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);

