-- Let Realtime read WAL rows so postgres_changes + RLS filtering works (often required; see Supabase Realtime + RLS docs).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_realtime') then
    grant select on public.order_messages to supabase_realtime;
  end if;
end $$;
