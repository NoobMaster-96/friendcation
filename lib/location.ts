import { supabase } from './supabase';
import type { MemberLocation } from './types';

export async function listMemberLocations(tripId: string): Promise<MemberLocation[]> {
  const { data: members, error: e1 } = await supabase
    .from('trip_members')
    .select('user_id, location_sharing_enabled, user_profiles(first_name)')
    .eq('trip_id', tripId);
  if (e1) throw e1;

  const { data: pings, error: e2 } = await supabase
    .from('location_pings')
    .select('user_id, latitude, longitude, updated_at')
    .eq('trip_id', tripId);
  if (e2) throw e2;

  const pingByUser = new Map<string, any>((pings ?? []).map((p: any) => [p.user_id, p]));

  return (members ?? []).map((m: any) => {
    const profile = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
    const ping = pingByUser.get(m.user_id);
    return {
      userId: m.user_id,
      name: profile?.first_name ?? 'Member',
      sharingEnabled: !!m.location_sharing_enabled,
      updatedAt: ping?.updated_at ?? null,
      latitude: ping?.latitude ?? null,
      longitude: ping?.longitude ?? null,
    };
  });
}

export async function setLocationSharing(
  tripId: string,
  userId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('trip_members')
    .update({ location_sharing_enabled: enabled })
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

export function formatAgo(iso: string | null): string {
  if (!iso) return 'no update yet';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'updated just now';
  if (min < 60) return `updated ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `updated ${hr}h ago`;
  return `updated ${Math.floor(hr / 24)}d ago`;
}
