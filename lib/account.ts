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
