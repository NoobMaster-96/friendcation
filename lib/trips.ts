import { supabase } from './supabase';
import type { Trip, TripListItem } from './types';

const TRIP_COLUMNS = 'id,name,start_date,end_date,created_by,invite_code,created_at';

/** Trips the given user is a member of, each with its member roster (for avatars). */
export async function listMyTrips(userId: string): Promise<TripListItem[]> {
  const { data: mine, error: e1 } = await supabase
    .from('trip_members')
    .select('trip_id, role')
    .eq('user_id', userId);
  if (e1) throw e1;

  const tripIds = (mine ?? []).map((m) => m.trip_id as string);
  if (tripIds.length === 0) return [];
  const roleByTrip = new Map<string, string>((mine ?? []).map((m) => [m.trip_id, m.role]));

  const { data: trips, error: e2 } = await supabase
    .from('trips')
    .select(`${TRIP_COLUMNS}, trip_members(user_id, user_profiles(first_name))`)
    .in('id', tripIds);
  if (e2) throw e2;

  return (trips ?? []).map((t: any) => {
    const members = (t.trip_members ?? []).map((m: any) => {
      const p = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
      const initial = (p?.first_name?.trim()?.[0] ?? '?').toUpperCase();
      return { id: m.user_id as string, initial };
    });
    return {
      id: t.id,
      name: t.name,
      start_date: t.start_date,
      end_date: t.end_date,
      created_by: t.created_by,
      invite_code: t.invite_code,
      created_at: t.created_at,
      role: roleByTrip.get(t.id) ?? 'member',
      members,
      memberCount: members.length,
    } as TripListItem;
  });
}

export type TripBuckets = { upcoming: TripListItem[]; past: TripListItem[] };

/** Splits trips into current/upcoming (end >= today or undated) and past. */
export function partitionTrips(trips: TripListItem[]): TripBuckets {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPast = (t: TripListItem) => t.end_date != null && parseLocalDate(t.end_date) < today;
  const startMs = (t: TripListItem) =>
    t.start_date ? parseLocalDate(t.start_date).getTime() : Number.MAX_SAFE_INTEGER;

  const upcoming = trips.filter((t) => !isPast(t)).sort((a, b) => startMs(a) - startMs(b));
  const past = trips.filter(isPast).sort((a, b) => startMs(b) - startMs(a));
  return { upcoming, past };
}

/**
 * Creates a trip and adds the creator as owner. Two writes (no client
 * transaction); on membership failure we best-effort delete the orphan trip.
 * NOTE: when RLS (0004) is enabled this should move to a SECURITY DEFINER RPC,
 * since insert-returning is blocked before membership exists.
 */
export async function createTrip(
  userId: string,
  name: string,
  startDate: string | null,
  endDate: string | null
): Promise<Trip> {
  const { data: trip, error } = await supabase
    .from('trips')
    .insert({ name: name.trim(), start_date: startDate, end_date: endDate, created_by: userId })
    .select(TRIP_COLUMNS)
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from('trip_members')
    .insert({ trip_id: trip.id, user_id: userId, role: 'owner' });
  if (memberError) {
    await supabase.from('trips').delete().eq('id', trip.id);
    throw memberError;
  }
  return trip as Trip;
}

/** Joins a trip by its invite code (idempotent if already a member). */
export async function joinTripByCode(userId: string, code: string): Promise<Trip> {
  const normalized = code.trim().toLowerCase();
  const { data: trip, error } = await supabase
    .from('trips')
    .select(TRIP_COLUMNS)
    .eq('invite_code', normalized)
    .maybeSingle();
  if (error) throw error;
  if (!trip) throw new Error('No trip found for that invite code.');

  const { error: memberError } = await supabase
    .from('trip_members')
    .upsert(
      { trip_id: trip.id, user_id: userId, role: 'member' },
      { onConflict: 'trip_id,user_id', ignoreDuplicates: true }
    );
  if (memberError) throw memberError;
  return trip as Trip;
}

/** Parses a 'YYYY-MM-DD' string in local time (no timezone shift). */
function parseLocalDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function formatDateRange(start: string | null, end: string | null): string {
  const currentYear = new Date().getFullYear();
  const fmt = (d: string) =>
    parseLocalDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const yearOf = (d: string) => parseLocalDate(d).getFullYear();

  if (start && end) {
    const base = `${fmt(start)} – ${fmt(end)}`;
    // Show a year only when the trip doesn't touch the current year.
    return yearOf(start) !== currentYear && yearOf(end) !== currentYear
      ? `${base} · ${yearOf(end)}`
      : base;
  }
  if (start) {
    const base = `From ${fmt(start)}`;
    return yearOf(start) !== currentYear ? `${base} · ${yearOf(start)}` : base;
  }
  if (end) {
    const base = `Until ${fmt(end)}`;
    return yearOf(end) !== currentYear ? `${base} · ${yearOf(end)}` : base;
  }
  return 'Dates TBD';
}

export function isValidDateStr(s: string): boolean {
  const v = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
