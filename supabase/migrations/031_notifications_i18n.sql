-- Add i18n-capable fields for notifications.
-- We keep legacy `title`/`message` (text) for backwards compatibility,
-- but prefer rendering via `title_key`/`message_key` + `params` in the UI.

alter table public.notifications
  add column if not exists title_key text,
  add column if not exists message_key text,
  add column if not exists params jsonb not null default '{}'::jsonb;

create index if not exists idx_notifications_type_created_at on public.notifications(type, created_at desc);
