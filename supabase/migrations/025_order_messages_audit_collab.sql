-- Order-scoped messaging, optional attachments bucket, commercial audit trail

do $enum$
begin
  alter type public.notification_type add value 'order_message';
exception
  when duplicate_object then null;
end
$enum$;

-- ---------------------------------------------------------------------------
-- Order messages (one thread per order)
-- ---------------------------------------------------------------------------
create table public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  author_id uuid not null references public.users (id),
  body text not null default '',
  attachment_path text,
  attachment_name text,
  created_at timestamptz not null default now(),
  constraint order_messages_body_or_attachment check (
    length(trim(body)) > 0
    or (attachment_path is not null and length(trim(attachment_path)) > 0)
  )
);

create index idx_order_messages_order_created on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;

create policy "order_messages_select_participants"
  on public.order_messages for select using (
    exists (
      select 1
      from public.orders o
      where o.id = order_messages.order_id
        and (
          o.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = o.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

create policy "order_messages_insert_participants"
  on public.order_messages for insert with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.orders o
      where o.id = order_messages.order_id
        and (
          o.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = o.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Audit log (commercial actions; dispute trail)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users (id),
  event_type text not null,
  order_id uuid not null references public.orders (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  retailer_id uuid not null references public.users (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_order_created on public.audit_log (order_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_participants"
  on public.audit_log for select using (
    auth.uid() = retailer_id
    or exists (
      select 1 from public.suppliers s
      where s.id = audit_log.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "audit_log_insert_actor_participant"
  on public.audit_log for insert with check (
    auth.uid() = actor_id
    and exists (
      select 1
      from public.orders o
      where o.id = audit_log.order_id
        and o.supplier_id = audit_log.supplier_id
        and o.retailer_id = audit_log.retailer_id
        and (
          o.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = o.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: private bucket for PO / delivery notes / message attachments
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('order-attachments', 'order-attachments', false)
on conflict (id) do update set
  public = excluded.public,
  name = excluded.name;

drop policy if exists "order_attachments_select" on storage.objects;
create policy "order_attachments_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'order-attachments'
    and exists (
      select 1
      from public.orders o
      where o.id = (split_part(name, '/', 1))::uuid
        and (
          o.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = o.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "order_attachments_insert" on storage.objects;
create policy "order_attachments_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'order-attachments'
    and (string_to_array(name, '/'))[2] = auth.uid()::text
    and exists (
      select 1
      from public.orders o
      where o.id = (split_part(name, '/', 1))::uuid
        and (
          o.retailer_id = auth.uid()
          or exists (
            select 1 from public.suppliers s
            where s.id = o.supplier_id and s.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "order_attachments_delete" on storage.objects;
create policy "order_attachments_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'order-attachments'
    and (string_to_array(name, '/'))[2] = auth.uid()::text
  );
