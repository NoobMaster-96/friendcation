import { supabase } from './supabase';

export type TripMember = {
  userId: string;
  name: string;
  email: string;
  role: string; // 'owner' | 'member'
  initials: string;
};

/** Thrown by addMemberByEmail when no account matches the email. */
export class EmailNotRegisteredError extends Error {
  constructor() {
    super('This email isn’t registered on Friendcation yet.');
    this.name = 'EmailNotRegisteredError';
  }
}

function initialsOf(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

export async function listTripMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('user_id, role, joined_at, user_profiles(first_name, last_name, email)')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((m: any) => {
    const p = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
    const first = p?.first_name?.trim() ?? '';
    const last = p?.last_name?.trim() ?? '';
    const name = `${first} ${last}`.trim() || 'Member';
    return {
      userId: m.user_id,
      name,
      email: p?.email ?? '',
      role: m.role ?? 'member',
      initials: initialsOf(first, last),
    };
  });
}

/**
 * Looks up an account by email and adds them to the trip. Throws
 * EmailNotRegisteredError when no account exists (invite-only app).
 */
/**
 * Adds via the add_trip_member_by_email RPC: profiles aren't readable by
 * non-trip-mates under RLS. Returns null from the RPC when the email isn't registered.
 */
export async function addMemberByEmail(tripId: string, email: string): Promise<TripMember> {
  const { data: profile, error } = await supabase.rpc('add_trip_member_by_email', {
    p_trip_id: tripId,
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  if (!profile) throw new EmailNotRegisteredError();

  const first = profile.first_name?.trim() ?? '';
  const last = profile.last_name?.trim() ?? '';
  return {
    userId: profile.id,
    name: `${first} ${last}`.trim() || 'Member',
    email: profile.email,
    role: 'member',
    initials: initialsOf(first, last),
  };
}

export async function removeMember(tripId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** A member leaving the trip is just removing their own membership. */
export async function leaveTrip(tripId: string, userId: string): Promise<void> {
  return removeMember(tripId, userId);
}

/** Deletes the trip; child rows cascade via the schema's ON DELETE CASCADE. */
export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) throw error;
}

export function inviteLink(inviteCode: string | null): string {
  return `friendcation.app/join/${inviteCode ?? ''}`;
}
