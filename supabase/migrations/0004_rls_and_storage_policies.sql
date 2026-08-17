-- ============================================================
-- Friendcation — Migration 0004: Row Level Security (THE SECURITY GATE)
-- Source of truth: handoff doc §7 (table RLS) + §8 (storage RLS).
--
-- ⚠️  HARD GATE: With RLS OFF, any authenticated client can read/write ANY row
-- in ANY table — including other people's location, expenses, and itinerary.
-- This migration enables and defines all access control. It MUST be applied
-- before any real friend uses the app. During early solo dev the live project
-- may run with RLS disabled for convenience; that is a deliberate, temporary
-- deviation — never ship it.
--
-- Fragility note (doc §7): the itinerary_items update/delete policies mix AND/OR.
-- Postgres parses `A and B or C` as `(A and B) or C`, which is correct here, but
-- the parentheses below are intentional and must stay — a misread silently over-
-- or under-shares data instead of erroring.
-- ============================================================

alter table user_profiles enable row level security;
alter table trips enable row level security;
alter table trip_members enable row level security;
alter table itinerary_items enable row level security;
alter table itinerary_attachments enable row level security;
alter table location_pings enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;
alter table itinerary_item_participants enable row level security;

-- ============ USER_PROFILES ============
create policy "user_profiles readable by any authenticated user"
  on user_profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on user_profiles for update
  using (auth.uid() = id);

-- ============ TRIPS ============
create policy "trip members can read the trip"
  on trips for select
  using (
    exists (select 1 from trip_members
      where trip_members.trip_id = trips.id and trip_members.user_id = auth.uid())
  );

create policy "authenticated users can create trips"
  on trips for insert
  with check (auth.uid() = created_by);

-- ============ TRIP_MEMBERS ============
create policy "trip members can see other members of their trips"
  on trip_members for select
  using (
    exists (select 1 from trip_members tm
      where tm.trip_id = trip_members.trip_id and tm.user_id = auth.uid())
  );

create policy "users can join a trip"
  on trip_members for insert
  with check (auth.uid() = user_id);

create policy "users can update their own membership settings"
  on trip_members for update
  using (auth.uid() = user_id);

-- ============ ITINERARY_ITEMS ============
create policy "trip members can read all itinerary items"
  on itinerary_items for select
  using (
    exists (select 1 from trip_members
      where trip_members.trip_id = itinerary_items.trip_id and trip_members.user_id = auth.uid())
  );

create policy "trip members can create itinerary items"
  on itinerary_items for insert
  with check (
    exists (select 1 from trip_members
      where trip_members.trip_id = itinerary_items.trip_id and trip_members.user_id = auth.uid())
  );

create policy "shared items editable by any member, personal items by owner only"
  on itinerary_items for update
  using (
    (item_type = 'shared' and exists (
      select 1 from trip_members
      where trip_members.trip_id = itinerary_items.trip_id and trip_members.user_id = auth.uid()
    ))
    or
    (item_type = 'personal' and created_by = auth.uid())
  );

create policy "shared items deletable by any member, personal items by owner only"
  on itinerary_items for delete
  using (
    (item_type = 'shared' and exists (
      select 1 from trip_members
      where trip_members.trip_id = itinerary_items.trip_id and trip_members.user_id = auth.uid()
    ))
    or
    (item_type = 'personal' and created_by = auth.uid())
  );

-- ============ ITINERARY_ATTACHMENTS ============
create policy "trip members can read attachments"
  on itinerary_attachments for select
  using (
    exists (
      select 1 from itinerary_items ii
      join trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = itinerary_attachments.itinerary_item_id
      and tm.user_id = auth.uid()
    )
  );

create policy "trip members can upload attachments to items they can edit"
  on itinerary_attachments for insert
  with check (
    auth.uid() = uploaded_by
    and exists (
      select 1 from itinerary_items ii
      join trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = itinerary_attachments.itinerary_item_id
      and tm.user_id = auth.uid()
      and (
        ii.item_type = 'shared'
        or (ii.item_type = 'personal' and ii.created_by = auth.uid())
      )
    )
  );

create policy "same rule applies to delete on attachments"
  on itinerary_attachments for delete
  using (
    exists (
      select 1 from itinerary_items ii
      join trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = itinerary_attachments.itinerary_item_id
      and tm.user_id = auth.uid()
      and (
        ii.item_type = 'shared'
        or (ii.item_type = 'personal' and ii.created_by = auth.uid())
      )
    )
  );

-- ============ ITINERARY_ITEM_PARTICIPANTS (added in 0006) ============
create policy "trip members can read item participants"
  on itinerary_item_participants for select
  using (
    exists (
      select 1 from itinerary_items ii
      join trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = itinerary_item_participants.itinerary_item_id
      and tm.user_id = auth.uid()
    )
  );

create policy "item editors can add participants"
  on itinerary_item_participants for insert
  with check (
    exists (
      select 1 from itinerary_items ii
      join trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = itinerary_item_participants.itinerary_item_id
      and tm.user_id = auth.uid()
      and (
        ii.item_type = 'shared'
        or (ii.item_type = 'personal' and ii.created_by = auth.uid())
      )
    )
  );

create policy "item editors can remove participants"
  on itinerary_item_participants for delete
  using (
    exists (
      select 1 from itinerary_items ii
      join trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = itinerary_item_participants.itinerary_item_id
      and tm.user_id = auth.uid()
      and (
        ii.item_type = 'shared'
        or (ii.item_type = 'personal' and ii.created_by = auth.uid())
      )
    )
  );

-- ============ LOCATION_PINGS ============
create policy "trip members can read location of members who opted in"
  on location_pings for select
  using (
    exists (select 1 from trip_members
      where trip_members.trip_id = location_pings.trip_id
      and trip_members.user_id = auth.uid()
      and trip_members.location_sharing_enabled = true)
  );

create policy "users can write their own location"
  on location_pings for insert
  with check (auth.uid() = user_id);

create policy "users can update their own location"
  on location_pings for update
  using (auth.uid() = user_id);

-- ============ EXPENSES ============
create policy "trip members can read expenses"
  on expenses for select
  using (
    exists (select 1 from trip_members
      where trip_members.trip_id = expenses.trip_id and trip_members.user_id = auth.uid())
  );

create policy "trip members can create expenses"
  on expenses for insert
  with check (
    auth.uid() = created_by
    and exists (select 1 from trip_members
      where trip_members.trip_id = expenses.trip_id and trip_members.user_id = auth.uid())
  );

create policy "creator can edit their expense entry"
  on expenses for update
  using (auth.uid() = created_by);

create policy "creator can delete their expense entry"
  on expenses for delete
  using (auth.uid() = created_by);

-- ============ EXPENSE_SPLITS ============
create policy "trip members can read splits for their trip's expenses"
  on expense_splits for select
  using (
    exists (select 1 from expenses e join trip_members tm on tm.trip_id = e.trip_id
      where e.id = expense_splits.expense_id and tm.user_id = auth.uid())
  );

create policy "expense creator can insert splits"
  on expense_splits for insert
  with check (
    exists (select 1 from expenses
      where expenses.id = expense_splits.expense_id and expenses.created_by = auth.uid())
  );

create policy "expense creator can update splits"
  on expense_splits for update
  using (
    exists (select 1 from expenses
      where expenses.id = expense_splits.expense_id and expenses.created_by = auth.uid())
  );

create policy "expense creator can delete splits"
  on expense_splits for delete
  using (
    exists (select 1 from expenses
      where expenses.id = expense_splits.expense_id and expenses.created_by = auth.uid())
  );

-- ============ SETTLEMENTS ============
create policy "trip members can read settlements"
  on settlements for select
  using (
    exists (select 1 from trip_members
      where trip_members.trip_id = settlements.trip_id and trip_members.user_id = auth.uid())
  );

create policy "either party can record a settlement"
  on settlements for insert
  with check (auth.uid() = paid_by or auth.uid() = paid_to);

-- ============================================================
-- STORAGE OBJECT POLICIES (bucket: itinerary-attachments)
-- Path convention {trip_id}/{itinerary_item_id}/{filename};
-- (storage.foldername(name))[1] is the trip_id segment.
-- ============================================================
create policy "trip members can read storage objects for their trips"
  on storage.objects for select
  using (
    bucket_id = 'itinerary-attachments'
    and exists (
      select 1 from trip_members tm
      where tm.trip_id::text = (storage.foldername(name))[1]
      and tm.user_id = auth.uid()
    )
  );

create policy "trip members can upload storage objects for their trips"
  on storage.objects for insert
  with check (
    bucket_id = 'itinerary-attachments'
    and exists (
      select 1 from trip_members tm
      where tm.trip_id::text = (storage.foldername(name))[1]
      and tm.user_id = auth.uid()
    )
  );
