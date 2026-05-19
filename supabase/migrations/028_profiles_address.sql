-- Add detailed address field to profiles
alter table public.profiles
  add column if not exists address text;

