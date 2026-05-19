-- Live updates for order-scoped messaging (Supabase Realtime / postgres_changes)
alter publication supabase_realtime add table public.order_messages;
