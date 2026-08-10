-- ============================================================
-- Friendcation — Migration 0001: core schema
-- Source of truth: handoff doc §4 (Database Schema).
--
-- Table is user_profiles (NOT `users` — avoids colliding with Supabase's
-- auth.users; NOT `profiles` for clarity). email is copied into user_profiles
-- at signup time (handoff doc "Option B").
-- ============================================================

create table user_profiles (
  id uuid references auth.users primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  avatar_url text,
  referral_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  referred_by uuid references user_profiles(id),
  created_at timestamptz default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  created_by uuid references user_profiles(id),
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

create table trip_members (
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references user_profiles(id),
  role text default 'member', -- 'owner' | 'member'
  location_sharing_enabled boolean default false,
  joined_at timestamptz default now(),
  primary key (trip_id, user_id)
);

create table itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  title text not null,
  location_name text,
  latitude double precision,
  longitude double precision,
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  item_type text not null default 'shared' check (item_type in ('personal', 'shared')),
  created_by uuid references user_profiles(id),
  created_at timestamptz default now()
);

create table itinerary_attachments (
  id uuid primary key default gen_random_uuid(),
  itinerary_item_id uuid references itinerary_items(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'image')),
  uploaded_by uuid references user_profiles(id),
  created_at timestamptz default now()
);

-- Only the latest ping per person per trip is stored (composite PK, overwritten
-- on each update). Deliberately NOT a history table — see handoff doc §4.
create table location_pings (
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references user_profiles(id),
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz default now(),
  primary key (trip_id, user_id)
);

-- created_by = who logged it (edit/delete permission).
-- paid_by    = who fronted the money (balance calc). Deliberately separate.
create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  created_by uuid references user_profiles(id) not null,
  paid_by uuid references user_profiles(id) not null,
  description text not null,
  amount numeric(10,2) not null,
  currency text default 'INR',
  category text, -- 'food' | 'transport' | 'stay' | 'activity' | 'other'
  expense_date date default current_date,
  created_at timestamptz default now()
);

-- Integrity note (handoff doc §6): sum(share_amount) per expense should equal
-- expenses.amount. NOT enforced in the DB — validate client-side before insert.
create table expense_splits (
  expense_id uuid references expenses(id) on delete cascade,
  user_id uuid references user_profiles(id),
  share_amount numeric(10,2) not null,
  primary key (expense_id, user_id)
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  paid_by uuid references user_profiles(id),
  paid_to uuid references user_profiles(id),
  amount numeric(10,2) not null,
  settled_at timestamptz default now()
);
