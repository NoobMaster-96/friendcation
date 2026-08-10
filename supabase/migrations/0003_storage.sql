-- ============================================================
-- Friendcation — Migration 0003: storage bucket
-- Source of truth: handoff doc §8 (Storage).
--
-- Private bucket (public = false) for itinerary attachments — booking
-- confirmations contain PNRs/names, so access is via signed URLs only.
-- Folder path convention: {trip_id}/{itinerary_item_id}/{filename}
--
-- The matching storage RLS policies live in 0004 (the security gate) so all
-- access control is enabled together.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('itinerary-attachments', 'itinerary-attachments', false)
on conflict (id) do nothing;
