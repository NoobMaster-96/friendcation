-- ============================================================
-- Friendcation — Migration 0010: invite code checks
--
-- The invite code is still each user's 6-character referral code
-- (user_profiles.referral_code), so codes already shared keep working —
-- including from older app builds, which send it as `referral_code`. This adds
-- what the invite-first Create account flow needs:
--  * invite_codes: one row per code, with an optional usage limit (max_uses,
--    null = unlimited), a use count and an optional expiry (expires_at,
--    null = never). Backfilled from every user's referral_code; the signup
--    trigger adds each new user's code.
--  * verify_invite_code(): Create account step 1, callable before signing in.
--    Returns validity, the reason when invalid, and the inviter's first name.
--  * handle_new_user_signup() validates the code again and consumes one use
--    under a row lock (two signups can't both take a code's last use), so a
--    code that expired or ran out after step 1 still blocks the signup.
-- Re-runnable.
-- ============================================================

create table if not exists public.invite_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  inviter_id uuid not null references public.user_profiles (id) on delete cascade,
  max_uses int check (max_uses is null or max_uses > 0),
  use_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invite_codes_inviter_idx on public.invite_codes (inviter_id);

-- No client access: only verify_invite_code() and the signup trigger use it.
alter table public.invite_codes enable row level security;
revoke all on table public.invite_codes from anon, authenticated;

insert into public.invite_codes (code, inviter_id)
select upper(referral_code), id from public.user_profiles
on conflict (code) do nothing;

-- Step 1 of Create account. Returns {valid: true, code, inviter_first_name}
-- or {valid: false, reason: 'not_found' | 'expired' | 'used_up'}.
create or replace function public.verify_invite_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select c.code, c.max_uses, c.use_count, c.expires_at, p.first_name
    into v
  from public.invite_codes c
  join public.user_profiles p on p.id = c.inviter_id
  where c.code = upper(trim(p_code));

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  if v.expires_at is not null and v.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;
  if v.max_uses is not null and v.use_count >= v.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'used_up');
  end if;
  return jsonb_build_object('valid', true, 'code', v.code, 'inviter_first_name', v.first_name);
end;
$$;
revoke all on function public.verify_invite_code(text) from public;
grant execute on function public.verify_invite_code(text) to anon, authenticated;

-- Signup: validate + consume the invite, create the profile, register the new
-- user's own code. SECURITY DEFINER with search_path '' (see 0002) — every
-- name is schema-qualified.
create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- `invite_code` from this app version, `referral_code` from older builds.
  v_code text := upper(trim(coalesce(
    new.raw_user_meta_data ->> 'invite_code',
    new.raw_user_meta_data ->> 'referral_code',
    ''
  )));
  v_invite public.invite_codes%rowtype;
  v_inviter uuid;
  v_own_code text;
  existing_count int;
begin
  select count(*) into existing_count from public.user_profiles;

  -- Bootstrap: the very first signup becomes the root and needs no code.
  if existing_count > 0 then
    select * into v_invite from public.invite_codes where code = v_code for update;
    if not found then
      raise exception 'Invalid invite code';
    end if;
    if v_invite.expires_at is not null and v_invite.expires_at <= now() then
      raise exception 'This invite code has expired';
    end if;
    if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
      raise exception 'This invite code has already been used';
    end if;
    update public.invite_codes set use_count = use_count + 1 where code = v_invite.code;
    v_inviter := v_invite.inviter_id;
  end if;

  insert into public.user_profiles (id, first_name, last_name, email, referred_by)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    v_inviter
  )
  returning referral_code into v_own_code;

  -- The new user's invite code is their referral_code (from the column default).
  insert into public.invite_codes (code, inviter_id) values (v_own_code, new.id);
  return new;
end;
$$;
