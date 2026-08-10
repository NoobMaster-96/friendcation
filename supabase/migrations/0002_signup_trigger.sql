-- ============================================================
-- Friendcation — Migration 0002: referral-based signup trigger
-- Source of truth: handoff doc §5 (Auth & Access Model: Referral System).
--
-- The app is referral-only at account-signup level. Every user has a unique
-- referral_code; a new signup must supply a valid existing code, and referred_by
-- is set to the referrer (giving a queryable referral graph).
--
-- Mechanics (do not "optimize" away without reading the doc):
--  * Fires AFTER INSERT on auth.users (the user_profiles.id FK needs the
--    auth.users row to already exist).
--  * On invalid code the exception rolls back the WHOLE transaction, including
--    the just-inserted auth.users row — so a bad code still fully blocks signup.
--  * The bootstrap branch (existing_count = 0) has a known, accepted race at
--    this app's scale (one person bootstrapping). NOT a pattern for real
--    multi-tenant products.
--
-- Client must pass first_name, last_name and (except bootstrap) referral_code
-- as auth metadata on supabase.auth.signUp(). No manual user_profiles insert.
-- ============================================================

create or replace function handle_new_user_signup()
returns trigger
language plpgsql
security definer
as $$
declare
  referrer_id uuid;
  existing_count int;
begin
  select count(*) into existing_count from user_profiles;

  -- bootstrap case: no users exist yet, this signup becomes the root
  if existing_count = 0 then
    insert into user_profiles (id, first_name, last_name, email)
    values (
      new.id,
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'last_name',
      new.email
    );
    return new;
  end if;

  select id into referrer_id
  from user_profiles
  where referral_code = upper(new.raw_user_meta_data->>'referral_code');

  if referrer_id is null then
    raise exception 'Invalid or missing referral code';
  end if;

  insert into user_profiles (id, first_name, last_name, email, referred_by)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.email,
    referrer_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user_signup();
