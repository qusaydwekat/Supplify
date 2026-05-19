create type notification_type as enum ('new_order', 'order_updated', 'invoice_issued', 'payment_recorded', 'low_stock');

create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  type notification_type not null,
  title text not null,
  message text not null,
  reference_id uuid,
  reference_type text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_is_read on public.notifications(user_id, is_read);

alter table public.notifications enable row level security;
create policy "Users see own notifications" on public.notifications for all using (auth.uid() = user_id);

