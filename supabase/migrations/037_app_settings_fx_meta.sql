-- Track last live FX sync for admin UI (optional metadata).
alter table public.app_settings
  add column if not exists fx_last_fetched_at timestamptz;

alter table public.app_settings
  add column if not exists fx_last_source text;

comment on column public.app_settings.fx_last_fetched_at is 'When exchange rates were last synced from a market feed.';
comment on column public.app_settings.fx_last_source is 'Identifier of the market data provider used for the last sync.';
