import { supabase } from './supabase';
import type { ItineraryListItem } from './types';

const COLUMNS =
  'id,trip_id,title,location_name,start_time,end_time,notes,item_type,created_by,' +
  'creator:user_profiles!created_by(first_name),' +
  'itinerary_attachments(count)';

export async function listItinerary(tripId: string): Promise<ItineraryListItem[]> {
  const { data, error } = await supabase
    .from('itinerary_items')
    .select(COLUMNS)
    .eq('trip_id', tripId)
    .order('start_time', { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const creator = Array.isArray(r.creator) ? r.creator[0] : r.creator;
    const attachmentCount = Array.isArray(r.itinerary_attachments)
      ? r.itinerary_attachments[0]?.count ?? 0
      : 0;
    return {
      id: r.id,
      trip_id: r.trip_id,
      title: r.title,
      location_name: r.location_name,
      start_time: r.start_time,
      end_time: r.end_time,
      notes: r.notes,
      item_type: r.item_type,
      created_by: r.created_by,
      creatorName: creator?.first_name ?? null,
      attachmentCount,
    };
  });
}

/** True when now falls within [start_time, end_time]. Needs both bounds. */
export function isNowItem(item: ItineraryListItem, now: Date = new Date()): boolean {
  if (!item.start_time || !item.end_time) return false;
  const start = new Date(item.start_time).getTime();
  const end = new Date(item.end_time).getTime();
  const t = now.getTime();
  return start <= t && t <= end;
}

/** "3:00 PM", "Tomorrow, 9:00 AM", "Aug 22, 7:30 PM" (relative to `now`). */
export function formatItemTime(startISO: string | null, now: Date = new Date()): string {
  if (!startISO) return 'Anytime';
  const d = new Date(startISO);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}
