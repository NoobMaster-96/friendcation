-- ============================================================
-- Friendcation — Migration 0008: Row Level Security (THE SECURITY GATE)
--
-- ⚠️  HARD GATE: with RLS off, anyone holding the anon/publishable key (it ships
-- inside the app) can read and write every row. Apply before inviting anyone.
--
-- Supersedes 0004, which was never applied and would have broken the app: its
-- trip_members SELECT policy queried trip_members itself (Postgres rejects that
-- as infinite recursion, and nearly every other policy checks membership through
-- that table), and trip edit/delete, adding/removing members, leaving, joining by
-- invite code and creating a trip had no working policy.
--
-- Design
-- - Membership checks go through SECURITY DEFINER helpers so policies never
--   recurse through trip_members' own RLS.
-- - Joining by invite code and adding someone by email are SECURITY DEFINER RPCs:
--   a non-member can't read the trip, and profiles aren't public.
-- - Profiles are visible only to yourself and people you share a trip with.
-- - Column privileges stop clients rewriting ownership fields (created_by, role,
--   trip_id) even on rows they're allowed to update.
-- Storage policies for attachments live in 0007 (already applied).
-- Re-runnable: policies are dropped before being created.
-- ============================================================

-- ============ HELPERS ============
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.shares_trip_with(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

-- ============ RPCs ============
-- Join a trip with its invite code. Returns the trip id, or null for an unknown code.
create or replace function public.join_trip_by_code(p_code text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  select id into v_trip_id from public.trips where invite_code = lower(trim(p_code));
  if v_trip_id is null then
    return null;
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (v_trip_id, auth.uid(), 'member')
  on conflict (trip_id, user_id) do nothing;
  return v_trip_id;
end;
$$;

-- Add a registered user to a trip by email; the caller must be a member.
-- Returns the added profile as JSON, or null when no account uses that email.
create or replace function public.add_trip_member_by_email(p_trip_id uuid, p_email text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.user_profiles%rowtype;
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'Only members of this trip can add people.' using errcode = '42501';
  end if;
  select * into v_profile from public.user_profiles
  where lower(email) = lower(trim(p_email))
  limit 1;
  if not found then
    return null;
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (p_trip_id, v_profile.id, 'member')
  on conflict (trip_id, user_id) do nothing;
  return jsonb_build_object(
    'id', v_profile.id,
    'first_name', v_profile.first_name,
    'last_name', v_profile.last_name,
    'email', v_profile.email
  );
end;
$$;

revoke all on function public.join_trip_by_code(text) from public, anon;
revoke all on function public.add_trip_member_by_email(uuid, text) from public, anon;
grant execute on function public.join_trip_by_code(text) to authenticated;
grant execute on function public.add_trip_member_by_email(uuid, text) to authenticated;

-- ============ ENABLE RLS ============
alter table public.user_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.itinerary_attachments enable row level security;
alter table public.itinerary_item_participants enable row level security;
alter table public.location_pings enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

-- ============ USER_PROFILES ============
-- Created by the signup trigger (SECURITY DEFINER), so no insert policy.
drop policy if exists "profiles: self and trip-mates can read" on public.user_profiles;
create policy "profiles: self and trip-mates can read"
  on public.user_profiles for select to authenticated
  using (id = auth.uid() or public.shares_trip_with(id));

drop policy if exists "profiles: update own" on public.user_profiles;
create policy "profiles: update own"
  on public.user_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============ TRIPS ============
-- The creator can read the trip before their membership row exists (insert … returning).
drop policy if exists "trips: members and creator can read" on public.trips;
create policy "trips: members and creator can read"
  on public.trips for select to authenticated
  using (public.is_trip_member(id) or created_by = auth.uid());

drop policy if exists "trips: create as yourself" on public.trips;
create policy "trips: create as yourself"
  on public.trips for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "trips: members can edit" on public.trips;
create policy "trips: members can edit"
  on public.trips for update to authenticated
  using (public.is_trip_member(id))
  with check (public.is_trip_member(id));

drop policy if exists "trips: owner can delete" on public.trips;
create policy "trips: owner can delete"
  on public.trips for delete to authenticated
  using (public.is_trip_owner(id) or created_by = auth.uid());

-- ============ TRIP_MEMBERS ============
-- Joining by code and adding by email go through the RPCs above.
drop policy if exists "members: visible to trip-mates" on public.trip_members;
create policy "members: visible to trip-mates"
  on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "members: creator joins own trip as owner" on public.trip_members;
create policy "members: creator joins own trip as owner"
  on public.trip_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id and t.created_by = auth.uid()
    )
  );

drop policy if exists "members: update own settings" on public.trip_members;
create policy "members: update own settings"
  on public.trip_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "members: leave, or owner removes" on public.trip_members;
create policy "members: leave, or owner removes"
  on public.trip_members for delete to authenticated
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- ============ ITINERARY_ITEMS ============
drop policy if exists "items: members can read" on public.itinerary_items;
create policy "items: members can read"
  on public.itinerary_items for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "items: members create as themselves" on public.itinerary_items;
create policy "items: members create as themselves"
  on public.itinerary_items for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());

-- Editing may turn a shared item personal (one person tagged), so the new row
-- only has to stay in one of the editor's trips.
drop policy if exists "items: shared by any member, personal by creator" on public.itinerary_items;
create policy "items: shared by any member, personal by creator"
  on public.itinerary_items for update to authenticated
  using (
    public.is_trip_member(trip_id)
    and (item_type = 'shared' or created_by = auth.uid())
  )
  with check (public.is_trip_member(trip_id));

drop policy if exists "items: delete shared by any member, personal by creator" on public.itinerary_items;
create policy "items: delete shared by any member, personal by creator"
  on public.itinerary_items for delete to authenticated
  using (
    public.is_trip_member(trip_id)
    and (item_type = 'shared' or created_by = auth.uid())
  );

-- ============ ITINERARY_ATTACHMENTS ============
drop policy if exists "attachments: members can read" on public.itinerary_attachments;
create policy "attachments: members can read"
  on public.itinerary_attachments for select to authenticated
  using (
    exists (
      select 1 from public.itinerary_items ii
      where ii.id = itinerary_attachments.itinerary_item_id
      and public.is_trip_member(ii.trip_id)
    )
  );

drop policy if exists "attachments: item editors upload as themselves" on public.itinerary_attachments;
create policy "attachments: item editors upload as themselves"
  on public.itinerary_attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.itinerary_items ii
      where ii.id = itinerary_attachments.itinerary_item_id
      and public.is_trip_member(ii.trip_id)
      and (ii.item_type = 'shared' or ii.created_by = auth.uid())
    )
  );

drop policy if exists "attachments: item editors delete" on public.itinerary_attachments;
create policy "attachments: item editors delete"
  on public.itinerary_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.itinerary_items ii
      where ii.id = itinerary_attachments.itinerary_item_id
      and public.is_trip_member(ii.trip_id)
      and (ii.item_type = 'shared' or ii.created_by = auth.uid())
    )
  );

-- ============ ITINERARY_ITEM_PARTICIPANTS ============
-- "Who's involved" tags: any trip member may set them, but only to trip members.
drop policy if exists "participants: members can read" on public.itinerary_item_participants;
create policy "participants: members can read"
  on public.itinerary_item_participants for select to authenticated
  using (
    exists (
      select 1 from public.itinerary_items ii
      where ii.id = itinerary_item_participants.itinerary_item_id
      and public.is_trip_member(ii.trip_id)
    )
  );

drop policy if exists "participants: members tag trip-mates" on public.itinerary_item_participants;
create policy "participants: members tag trip-mates"
  on public.itinerary_item_participants for insert to authenticated
  with check (
    exists (
      select 1 from public.itinerary_items ii
      join public.trip_members tm
        on tm.trip_id = ii.trip_id and tm.user_id = itinerary_item_participants.user_id
      where ii.id = itinerary_item_participants.itinerary_item_id
      and public.is_trip_member(ii.trip_id)
    )
  );

drop policy if exists "participants: members untag" on public.itinerary_item_participants;
create policy "participants: members untag"
  on public.itinerary_item_participants for delete to authenticated
  using (
    exists (
      select 1 from public.itinerary_items ii
      where ii.id = itinerary_item_participants.itinerary_item_id
      and public.is_trip_member(ii.trip_id)
    )
  );

-- ============ LOCATION_PINGS ============
-- A member's location is visible to trip-mates only while that member shares it.
drop policy if exists "pings: trip-mates see members who share" on public.location_pings;
create policy "pings: trip-mates see members who share"
  on public.location_pings for select to authenticated
  using (
    public.is_trip_member(trip_id)
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = location_pings.trip_id
      and tm.user_id = location_pings.user_id
      and tm.location_sharing_enabled
    )
  );

drop policy if exists "pings: write own" on public.location_pings;
create policy "pings: write own"
  on public.location_pings for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "pings: update own" on public.location_pings;
create policy "pings: update own"
  on public.location_pings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

-- ============ EXPENSES ============
drop policy if exists "expenses: members can read" on public.expenses;
create policy "expenses: members can read"
  on public.expenses for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "expenses: members log, paid by a trip-mate" on public.expenses;
create policy "expenses: members log, paid by a trip-mate"
  on public.expenses for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_trip_member(trip_id)
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = expenses.trip_id and tm.user_id = expenses.paid_by
    )
  );

drop policy if exists "expenses: creator can edit" on public.expenses;
create policy "expenses: creator can edit"
  on public.expenses for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and public.is_trip_member(trip_id));

drop policy if exists "expenses: creator can delete" on public.expenses;
create policy "expenses: creator can delete"
  on public.expenses for delete to authenticated
  using (created_by = auth.uid());

-- ============ EXPENSE_SPLITS ============
drop policy if exists "splits: members can read" on public.expense_splits;
create policy "splits: members can read"
  on public.expense_splits for select to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
    )
  );

drop policy if exists "splits: expense creator adds trip-mates" on public.expense_splits;
create policy "splits: expense creator adds trip-mates"
  on public.expense_splits for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm
        on tm.trip_id = e.trip_id and tm.user_id = expense_splits.user_id
      where e.id = expense_splits.expense_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "splits: expense creator edits" on public.expense_splits;
create policy "splits: expense creator edits"
  on public.expense_splits for update to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and e.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      join public.trip_members tm
        on tm.trip_id = e.trip_id and tm.user_id = expense_splits.user_id
      where e.id = expense_splits.expense_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "splits: expense creator deletes" on public.expense_splits;
create policy "splits: expense creator deletes"
  on public.expense_splits for delete to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id and e.created_by = auth.uid()
    )
  );

-- ============ SETTLEMENTS ============
drop policy if exists "settlements: members can read" on public.settlements;
create policy "settlements: members can read"
  on public.settlements for select to authenticated
  using (public.is_trip_member(trip_id));

drop policy if exists "settlements: either party records" on public.settlements;
create policy "settlements: either party records"
  on public.settlements for insert to authenticated
  with check (
    public.is_trip_member(trip_id)
    and (paid_by = auth.uid() or paid_to = auth.uid())
  );

-- ============ COLUMN PRIVILEGES ============
-- Rows a user may update still can't have their ownership fields rewritten.
revoke update on public.trips from anon, authenticated;
grant update (name, start_date, end_date) on public.trips to authenticated;

revoke update on public.trip_members from anon, authenticated;
grant update (location_sharing_enabled) on public.trip_members to authenticated;

revoke update on public.itinerary_items from anon, authenticated;
grant update (title, location_name, start_time, end_time, notes, item_type)
  on public.itinerary_items to authenticated;

revoke update on public.user_profiles from anon, authenticated;
grant update (first_name, last_name, avatar_url) on public.user_profiles to authenticated;
