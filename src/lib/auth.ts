// ── Sign in with Gothwad (Gothwad Accounts, OAuth 2.0 + PKCE) ────────
// Flow accounts repo ke docs/OAUTH.md se hai - khud se auth invent mat karna.
// 1) Cookie SSO: Worker /api/me Accounts ki .gothwadtech.com cookie se session
//    pehchan lega (subdomains par user pehle se logged-in milega).
// 2) OAuth fallback: yahan se authorize redirect + PKCE, callback par code
//    Worker ke /api/auth/exchange se token me badlega (secret browser me nahi).
import { API_BASE, AUTH_BASE, AUTH_SIGNIN_URL, OAUTH_CLIENT_ID } from './config';
import type { GothwadUser } from '../types';

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function startGothwadSignIn() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_return', window.location.pathname + window.location.search);

  const u = new URL('/oauth/authorize', AUTH_BASE + '/');
  u.searchParams.set('client_id', OAUTH_CLIENT_ID);
  u.searchParams.set('redirect_uri', window.location.origin + '/auth/callback');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'profile email offline_access');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  window.location.href = u.toString();
}

export function signInPageUrl(): string {
  const next = encodeURIComponent(window.location.origin + '/auth/callback');
  return `${AUTH_SIGNIN_URL}/signin?choose=1&next=${next}`;
}

/** /auth/callback par: code -> apne Worker se exchange -> user */
export async function handleOAuthCallback(): Promise<{ user: GothwadUser } | { error: string }> {
  const p = new URLSearchParams(window.location.search);
  if (p.get('error')) return { error: p.get('error')! };
  if (p.get('state') !== sessionStorage.getItem('oauth_state'))
    return { error: 'state_mismatch' };
  try {
    const res = await fetch(`${API_BASE}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        code: p.get('code'),
        redirectUri: window.location.origin + '/auth/callback',
        codeVerifier: sessionStorage.getItem('pkce_verifier'),
      }),
    });
    if (!res.ok) return { error: 'exchange_failed' };
    const data = await res.json();
    if (data.accessToken) sessionStorage.setItem('kiwi_access_token', data.accessToken);
    if (data.refreshToken) sessionStorage.setItem('kiwi_refresh_token', data.refreshToken);
    return { user: data.user };
  } catch {
    return { error: 'network' };
  }
}

export function authHeaders(): Record<string, string> {
  const t = sessionStorage.getItem('kiwi_access_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Worker /api/me - cookie ya Bearer se Accounts session verify */
export async function fetchMe(): Promise<GothwadUser | null> {
  try {
    const res = await fetch(`${API_BASE}/me`, { credentials: 'include', headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function signOut() {
  try {
    await fetch(`${API_BASE}/auth/signout`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
    });
  } catch { /* ignore */ }
  sessionStorage.removeItem('kiwi_access_token');
  sessionStorage.removeItem('kiwi_refresh_token');
}

// Local preview identity; AppContext exposes it only after isDemoModeAllowed()
// confirms that the current hostname is not a Gothwad production domain.
export const DEMO_USER: GothwadUser = {
  id: 'demo-user-1',
  username: 'pawan',
  name: 'Gothwad',
  email: 'pawan@gothwadtech.com',
};
