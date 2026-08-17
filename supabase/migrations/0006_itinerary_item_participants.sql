-- ============================================================
-- Friendcation — Migration 0006: itinerary item participants
--
-- The "People" on an itinerary item (who a plan involves). The base schema only
-- had item_type + created_by; this join table records the selected members so
-- the item detail can show People chips and edit can pre-fill them.
--
-- RLS is intentionally NOT enabled here — it matches the current dev state where
-- RLS is off on every table. The enable + policies for this table live in
-- 0004_rls_and_storage_policies.sql (the security gate), applied before real use.
-- ============================================================

create table itinerary_item_participants (
  itinerary_item_id uuid references itinerary_items(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete cascade,
  primary key (itinerary_item_id, user_id)
);
