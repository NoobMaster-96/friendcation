import { supabase } from './supabase';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Best-effort check that an email isn't already registered — used as the step-1
 * gate before collecting a password. This is only a UX nicety: the real
 * uniqueness enforcement is auth.users' unique email constraint at signUp().
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();

  // Preferred: SECURITY DEFINER RPC — works even with RLS enabled (needs 0005).
  const viaRpc = await supabase.rpc('email_available', { check_email: normalized });
  if (!viaRpc.error) return Boolean(viaRpc.data);

  // Fallback: direct read (works while RLS is disabled). If this also errors we
  // can't tell, so allow the flow to proceed and let signUp() reject duplicates.
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .ilike('email', normalized)
    .limit(1);
  if (error) return true;
  return (data?.length ?? 0) === 0;
}

// ============================================================
// Invite codes — each user's 6-character code (checks: migration 0010)
// ============================================================

export const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export type InviteCheck =
  | { valid: true; code: string; inviterFirstName: string }
  | { valid: false; reason: 'not_found' | 'expired' | 'used_up' };

/** As-you-type: uppercase, letters and digits only, at most 6 (" 4f9a-2c" → "4F9A2C"). */
export function formatInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function inviteErrorMessage(reason: 'not_found' | 'expired' | 'used_up'): string {
  switch (reason) {
    case 'expired':
      return 'This invite code has expired. Ask your friend for a new one.';
    case 'used_up':
      return 'This invite code has already been used.';
    default:
      return 'We couldn’t find that invite code. Check it and try again.';
  }
}

/** Step 1 of Create account: does the code exist, and is it unexpired with uses left? */
export async function verifyInviteCode(code: string): Promise<InviteCheck> {
  const { data, error } = await supabase.rpc('verify_invite_code', { p_code: code });
  if (error) throw error;
  if (data?.valid) {
    return { valid: true, code: data.code, inviterFirstName: data.inviter_first_name ?? 'a friend' };
  }
  return { valid: false, reason: data?.reason ?? 'not_found' };
}
