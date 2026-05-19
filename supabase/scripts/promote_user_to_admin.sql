-- Run in Supabase SQL Editor after migrations 035 + 036 are applied.
-- Prerequisites: the account must already exist in auth.users and public.users (sign up or register first).

-- If login says email not confirmed: run confirm_email_manually.sql first, or confirm via the inbox link,
-- or Supabase Dashboard → Authentication → Users → user → Confirm user.

-- Option A — by email (edit the address):
update public.users
set role = 'admin'::public.user_role
where lower(trim(email)) = lower(trim('admin@supplify.com'));

-- Verify:
-- select id, email, role from public.users where role = 'admin'::public.user_role;

-- Option B — by user id (from Dashboard → Authentication → Users):
-- update public.users
-- set role = 'admin'::public.user_role
-- where id = '00000000-0000-0000-0000-000000000000'::uuid;
