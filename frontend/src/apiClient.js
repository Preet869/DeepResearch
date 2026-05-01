import { supabase } from './supabaseClient';

/**
 * Latest access token validated with Supabase Auth (not just local cache).
 * Calls getUser() first so tokens are refreshed/synced reliably after storage restore.
 */
export async function getSupabaseAccessToken() {
  if (!supabase) return null;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return null;

  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessionData?.session?.access_token) return null;

  const t = String(sessionData.session.access_token).trim();
  return t || null;
}

export const AUTH_REQUIRED = 'AUTH_REQUIRED';

async function authorizeHeaders(headersObj, auth, accessTokenOverride) {
  if (!auth) return headersObj;
  const token =
    typeof accessTokenOverride === 'string' && accessTokenOverride.trim()
      ? accessTokenOverride.trim()
      : await getSupabaseAccessToken();
  if (!token) {
    const err = new Error(AUTH_REQUIRED);
    err.code = AUTH_REQUIRED;
    throw err;
  }
  return { ...headersObj, Authorization: `Bearer ${token}` };
}

/**
 * fetch with Authorization: Bearer + Supabase JWT.
 * On 401, refreshes session once and retries (handles expired/local-stale JWT).
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

  headersObj = await authorizeHeaders(headersObj, auth, accessToken);

  let response = await fetch(input, { ...rest, headers: headersObj });

  if (auth && response.status === 401 && supabase) {
    const { error: refErr } = await supabase.auth.refreshSession();
    if (!refErr) {
      const headersRetry = headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : { ...(headers || {}) };
      const withAuth = await authorizeHeaders(headersRetry, auth, undefined);
      response = await fetch(input, { ...rest, headers: withAuth });
    }
  }

  return response;
}
