-- Manually mark an email as verified (dev / admin bootstrap).
-- Run in Supabase SQL Editor (service role / postgres can update auth.users).

-- Replace with your auth email:
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(trim(email)) = lower(trim('YOUR_EMAIL@example.com'));

-- Optional: check result
-- select id, email, email_confirmed_at from auth.users where email ilike '%YOUR_EMAIL%';
