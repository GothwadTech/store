// ── Sign in with Gothwad (Gothwad Accounts, .gothwadtech.com SSO + OAuth 2.0 PKCE) ──
// Web rule: NEVER store access_token or refresh_token in localStorage or sessionStorage.
// Primary web auth is .gothwadtech.com HttpOnly SSO cookies via Worker /api/me.
import {
  API_BASE,
  AUTH_BASE,
  AUTH_SIGNIN_URL,
  BRAND,
  OAUTH_CLIENT_ID,
  SITE_URLS,
  detectMode,
  isProductionHostCheck,
} from './config';
import { getAuthuserFromLocation } from './router';
import type { GothwadUser } from '../types';

let memoryAccessToken: string | null = null;
let selectedAuthuser: number | null = null;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function savePkceState(payload: { v: string; s: string; r: string }) {
  try {
    window.name = `kiwi_pkce:${JSON.stringify(payload)}`;
  } catch {
    /* ignore */
  }
}

function readPkceState(): { v?: string; s?: string; r?: string } {
  try {
    if (window.name.startsWith('kiwi_pkce:')) {
      return JSON.parse(window.name.slice('kiwi_pkce:'.length)) as {
        v?: string;
        s?: string;
        r?: string;
      };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function clearPkceState() {
  try {
    if (window.name.startsWith('kiwi_pkce:')) window.name = '';
  } catch {
    /* ignore */
  }
}

export function callbackRedirectUri(): string {
  if (isProductionHostCheck() && detectMode() === 'storeapp') {
    return `${SITE_URLS.store}/auth/callback`;
  }
  return `${window.location.origin}/auth/callback`;
}

export function authorizeEndpointUrl(): string {
  const origin = AUTH_BASE.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${origin}/oauth/authorize`;
}

export async function startGothwadSignIn(opts?: { authuser?: number }) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  savePkceState({
    v: verifier,
    s: state,
    r: window.location.pathname + window.location.search,
  });

  const u = new URL(authorizeEndpointUrl());
  u.searchParams.set('client_id', OAUTH_CLIENT_ID);
  u.searchParams.set('redirect_uri', callbackRedirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'profile email offline_access');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  const au = opts?.authuser ?? getAuthuserFromLocation();
  if (au !== null && au !== undefined) {
    u.searchParams.set('authuser', String(au));
  }
  window.location.href = u.toString();
}

export function signInPageUrl(): string {
  const next = encodeURIComponent(callbackRedirectUri());
  return `${AUTH_SIGNIN_URL}/signin?choose=1&next=${next}`;
}

export function addAccountUrl(): string {
  const next = encodeURIComponent(window.location.href);
  return `${AUTH_SIGNIN_URL}/signin?add=1&next=${next}`;
}

export function manageAccountUrl(authuser = 0): string {
  return `${AUTH_SIGNIN_URL}/u/${authuser}/me`;
}

export function setActiveAuthuser(index: number | null) {
  selectedAuthuser = index;
}

export function getActiveAuthuser(): number | null {
  return getAuthuserFromLocation() ?? selectedAuthuser;
}

/** /auth/callback par: code -> apne Worker se exchange -> user */
export async function handleOAuthCallback(): Promise<{ user: GothwadUser } | { error: string }> {
  const p = new URLSearchParams(window.location.search);
  if (p.get('error')) return { error: p.get('error')! };
  const pkce = readPkceState();
  if (pkce.s && p.get('state') !== pkce.s) {
    return { error: 'state_mismatch' };
  }
  try {
    const res = await fetch(`${API_BASE}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        code: p.get('code'),
        redirectUri: callbackRedirectUri(),
        codeVerifier: pkce.v ?? '',
      }),
    });
    clearPkceState();
    if (!res.ok) return { error: 'exchange_failed' };
    const data = await res.json();
    if (typeof data.accessToken === 'string' && data.accessToken) {
      memoryAccessToken = data.accessToken;
    }
    return { user: data.user };
  } catch {
    return { error: 'network' };
  }
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (memoryAccessToken) {
    headers.Authorization = `Bearer ${memoryAccessToken}`;
  }
  const au = getActiveAuthuser();
  if (au !== null && au >= 0 && au <= 5) {
    headers['X-Gothwad-Authuser'] = String(au);
  }
  return headers;
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

export async function signOut(slotId?: string) {
  const endpoint = slotId
    ? `${API_BASE}/auth/accounts/${encodeURIComponent(slotId)}/signout`
    : `${API_BASE}/auth/signout`;
  try {
    await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(slotId ? { id: slotId } : {}),
    });
  } catch {
    /* ignore */
  }
  if (!slotId) {
    memoryAccessToken = null;
  }
}

// Local preview identity; AppContext exposes it only after isDemoModeAllowed()
// confirms that the current hostname is not a Gothwad production domain.
export const DEMO_USER: GothwadUser = {
  id: 'demo-user-1',
  username: 'pawan',
  name: 'Gothwad',
  email: `pawan@${BRAND.appDomain}`,
};
