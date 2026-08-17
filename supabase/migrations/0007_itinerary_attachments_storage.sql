-- ============================================================
-- Friendcation — Migration 0007: itinerary-attachments storage policies
--
-- storage.objects RLS policies that let a trip member read / upload / delete
-- files under their own trip's folder. The bucket itself is created in
-- 0003_storage.sql.
--
-- Why this is split out of 0004 (the RLS gate): storage.objects always has RLS
-- enabled by Supabase, so — unlike the public tables, which run RLS-off in dev —
-- attachments CANNOT upload until these policies exist. This migration is
-- therefore safe (and required) to apply in dev; it touches no public table.
--
-- Path convention: {trip_id}/{itinerary_item_id}/{filename}
-- (storage.foldername(name))[1] is the trip_id segment.
-- ============================================================

drop policy if exists "trip members can read storage objects for their trips" on storage.objects;
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

drop policy if exists "trip members can upload storage objects for their trips" on storage.objects;
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

drop policy if exists "trip members can delete storage objects for their trips" on storage.objects;
create policy "trip members can delete storage objects for their trips"
  on storage.objects for delete
  using (
    bucket_id = 'itinerary-attachments'
    and exists (
      select 1 from trip_members tm
      where tm.trip_id::text = (storage.foldername(name))[1]
      and tm.user_id = auth.uid()
    )
  );
