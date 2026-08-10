-- ============================================================
-- Friendcation — Migration 0005: email-availability RPC
--
-- Powers the two-step signup's step-1 gate ("is this email already taken?")
-- BEFORE the user sets a password. SECURITY DEFINER so it works even once RLS
-- is enabled (0004) — an anonymous visitor can't read user_profiles directly,
-- but can ask this function a yes/no question.
--
-- Returns only a boolean (no row data). This is an email-enumeration surface,
-- which is acceptable for an invite-only app of this size.
-- ============================================================

create or replace function public.email_available(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from user_profiles where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.email_available(text) to anon, authenticated;
