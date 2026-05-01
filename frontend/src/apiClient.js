import { supabase } from './supabaseClient';

/**
 * Prefer this over AuthContext.token for API calls — always reads the latest session
 * after refresh / restore (avoids Bearer null races).
 */
export async function getSupabaseAccessToken() {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) return null;
  const t = String(session.access_token).trim();
  return t || null;
}

export const AUTH_REQUIRED = 'AUTH_REQUIRED';

/**
 * Wrapper around fetch that attaches Authorization: Bearer + Supabase JWT.
 *
 * @param {string|URL} input
 * @param {RequestInit & { auth?: boolean, accessToken?: string }} init
 */
export async function apiFetch(input, init = {}) {
  const { auth = true, accessToken, headers, ...rest } = init;
  let headersObj =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : { ...(headers || {}) };

  if (auth) {
    const token =
      typeof accessToken === 'string' && accessToken.trim()
        ? accessToken.trim()
        : await getSupabaseAccessToken();
    if (!token) {
      const err = new Error(AUTH_REQUIRED);
      err.code = AUTH_REQUIRED;
      throw err;
    }
    headersObj.Authorization = `Bearer ${token}`;
  }

  return fetch(input, { ...rest, headers: headersObj });
}
