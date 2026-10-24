// First-party Gothwad Accounts SSO (.gothwadtech.com HttpOnly cookies)
// Web rule: NEVER store access_token or refresh_token in localStorage or sessionStorage.
import {
  API_BASE,
  AUTH_BASE,
  AUTH_SIGNIN_URL,
  BRAND,
  SITE_URLS,
  detectMode,
  isProductionHostCheck,
} from './config';
import { getAuthuserFromLocation, resolveSignOutSlotId } from './authuser';
import type { AccountSlotItem, GothwadUser } from '../types';

export { resolveSignOutSlotId };

let memoryAccessToken: string | null = null;
let selectedAuthuser: number | null = null;
let authGeneration = 0;

export function getAuthGeneration(): number {
  return authGeneration;
}

export function bumpAuthGeneration(): number {
  authGeneration += 1;
  return authGeneration;
}

export function accountsApiOrigin(): string {
  return AUTH_BASE.replace(/\/+$/, '').replace(/\/api$/, '');
}

export function accountsWebOrigin(): string {
  return AUTH_SIGNIN_URL.replace(/\/+$/, '');
}

export function callbackRedirectUri(): string {
  if (isProductionHostCheck() && detectMode() === 'storeapp') {
    return `${SITE_URLS.store}/auth/callback`;
  }
  return `${window.location.origin}/auth/callback`;
}

export function sanitizeNextUrl(candidate?: string): string {
  const fallback =
    typeof window !== 'undefined' && window.location?.href ? window.location.href : SITE_URLS.store;
  const raw = (candidate ?? '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}${raw}`
      : `${SITE_URLS.store}${raw}`;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;
    const host = parsed.hostname.toLowerCase();
    if (
      host === BRAND.appDomain ||
      host.endsWith(`.${BRAND.appDomain}`) ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      (typeof window !== 'undefined' && host === window.location?.hostname?.toLowerCase())
    ) {
      return parsed.toString();
    }
  } catch {
    /* ignore invalid URL */
  }
  return fallback;
}

export function buildSignInUrl(opts?: {
  nextUrl?: string;
  choose?: boolean;
  add?: boolean;
  authuser?: number | null;
}): string {
  const base = accountsWebOrigin();
  const next = sanitizeNextUrl(opts?.nextUrl);
  const u = new URL(`${base}/signin`);
  if (opts?.choose) u.searchParams.set('choose', '1');
  if (opts?.add) {
    u.searchParams.set('choose', '1');
    u.searchParams.set('add', '1');
  }
  const au = opts?.authuser ?? getAuthuserFromLocation();
  if (au !== null && au !== undefined && au >= 0 && au <= 5) {
    u.searchParams.set('authuser', String(au));
  }
  u.searchParams.set('next', next);
  return u.toString();
}

export async function startGothwadSignIn(opts?: {
  nextUrl?: string;
  choose?: boolean;
  add?: boolean;
  authuser?: number | null;
}): Promise<void> {
  if (typeof window !== 'undefined') {
    window.location.href = buildSignInUrl(opts);
  }
}

export function signInPageUrl(nextUrl?: string): string {
  return buildSignInUrl({ nextUrl, choose: true });
}

export function addAccountUrl(nextUrl?: string): string {
  return buildSignInUrl({ nextUrl, choose: true, add: true });
}

export function manageAccountUrl(authuser = 0): string {
  return `${accountsWebOrigin()}/u/${authuser}/me`;
}

export function widgetScriptUrl(): string {
  return `${accountsWebOrigin()}/widget/account-menu.js`;
}

export function setActiveAuthuser(index: number | null): void {
  selectedAuthuser = index;
}

export function getActiveAuthuser(): number | null {
  return getAuthuserFromLocation() ?? selectedAuthuser;
}

export function authHeaders(explicitAuthuser?: number | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (memoryAccessToken) {
    headers.Authorization = `Bearer ${memoryAccessToken}`;
  }
  const au = explicitAuthuser !== undefined ? explicitAuthuser : getActiveAuthuser();
  if (au !== null && au !== undefined && au >= 0 && au <= 5) {
    headers['X-Gothwad-Authuser'] = String(au);
  }
  return headers;
}

export function normalizeClientUser(raw: Record<string, unknown> | null | undefined): GothwadUser | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const username = String(raw.username ?? raw.preferred_username ?? '').trim().toLowerCase();
  const id = String(raw.id ?? raw.sub ?? username).trim();
  if (!username && !id) return null;
  const firstName = String(raw.firstName ?? raw.first_name ?? '').trim();
  const lastName = String(raw.lastName ?? raw.last_name ?? '').trim();
  const name =
    String(raw.name ?? ([firstName, lastName].filter(Boolean).join(' ') || username)).trim() ||
    username;
  const email = String(raw.email ?? `${username}@${BRAND.appDomain}`).trim().toLowerCase();
  const avatarUrl = String(raw.avatarUrl ?? raw.avatar_url ?? raw.picture ?? '').trim() || undefined;
  return {
    id: id || username,
    username: username || id.toLowerCase(),
    name,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email,
    picture: avatarUrl,
    avatarUrl,
  };
}

export function normalizeClientAccounts(
  rawAccounts: unknown,
  activeId: string | null,
): AccountSlotItem[] {
  if (!Array.isArray(rawAccounts)) return [];
  return rawAccounts
    .map((item, idx): AccountSlotItem | null => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      const username = String(r.username ?? '').trim().toLowerCase();
      const id = String(r.id ?? r.slot ?? idx).trim();
      if (!username && !id) return null;
      const authuser = typeof r.authuser === 'number' ? r.authuser : idx;
      const firstName = String(r.firstName ?? r.first_name ?? '').trim();
      const lastName = String(r.lastName ?? r.last_name ?? '').trim();
      const name =
        String(r.name ?? ([firstName, lastName].filter(Boolean).join(' ') || username)).trim() ||
        username;
      const email = String(r.email ?? `${username}@${BRAND.appDomain}`).trim().toLowerCase();
      const avatarUrl = String(r.avatarUrl ?? r.avatar_url ?? r.picture ?? '').trim() || null;
      return {
        id,
        slot: id,
        authuser,
        username,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name,
        email,
        avatarUrl,
        picture: avatarUrl,
        accountUrl: String(r.accountUrl ?? manageAccountUrl(authuser)),
        active: activeId ? id === activeId : idx === 0,
      };
    })
    .filter((x): x is AccountSlotItem => x !== null);
}

export type DirectAccountsSessionResult =
  | {
      status: 'authenticated';
      user: GothwadUser;
      activeSlot: string | null;
      authuser: number;
      accounts: AccountSlotItem[];
    }
  | {
      status: 'anonymous';
      user: null;
      activeSlot: null;
      authuser: number;
      accounts: AccountSlotItem[];
    }
  | {
      status: 'unavailable';
      user: null;
      activeSlot: null;
      authuser: number;
      accounts: AccountSlotItem[];
      code: string;
      message: string;
    };

/**
 * Direct browser silent SSO check against Gothwad Accounts API (`/api/auth/me`)
 * preserving distinct `authenticated`, `anonymous`, and `unavailable` states.
 */
export async function resolveDirectAccountsSession(opts?: {
  signal?: AbortSignal;
  authuser?: number | null;
}): Promise<DirectAccountsSessionResult> {
  const effectiveAuthuser = opts?.authuser !== undefined ? opts.authuser : (getActiveAuthuser() ?? 0);
  try {
    const res = await fetch(`${accountsApiOrigin()}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: opts?.signal,
      headers: { Accept: 'application/json', ...authHeaders(opts?.authuser) },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        status: 'anonymous',
        user: null,
        activeSlot: null,
        authuser: effectiveAuthuser ?? 0,
        accounts: [],
      };
    }
    if (res.status === 429) {
      return {
        status: 'unavailable',
        user: null,
        activeSlot: null,
        authuser: effectiveAuthuser ?? 0,
        accounts: [],
        code: 'rate_limited',
        message: 'Too many authentication requests. Please wait a moment and try again.',
      };
    }
    if (!res.ok) {
      return {
        status: 'unavailable',
        user: null,
        activeSlot: null,
        authuser: effectiveAuthuser ?? 0,
        accounts: [],
        code: `accounts_http_${res.status}`,
        message: 'Gothwad Accounts is temporarily unavailable. Please try again.',
      };
    }
    const text = await res.text();
    let d: Record<string, unknown> | null = null;
    try {
      const parsed = text ? JSON.parse(text) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        d = parsed as Record<string, unknown>;
      }
    } catch {
      d = null;
    }
    if (!d) {
      return {
        status: 'unavailable',
        user: null,
        activeSlot: null,
        authuser: effectiveAuthuser ?? 0,
        accounts: [],
        code: 'invalid_response',
        message: 'Received an unexpected response from Gothwad Accounts.',
      };
    }
    const activeSlot =
      typeof d.activeId === 'string'
        ? d.activeId
        : typeof d.activeSlot === 'string'
          ? d.activeSlot
          : null;
    const authuser =
      typeof d.authuser === 'number' ? d.authuser : (effectiveAuthuser ?? 0);
    const accounts = normalizeClientAccounts(d.accounts, activeSlot);
    if (d.authenticated === false) {
      return {
        status: 'anonymous',
        user: null,
        activeSlot: null,
        authuser,
        accounts,
      };
    }
    const rawUser =
      d.user && typeof d.user === 'object'
        ? (d.user as Record<string, unknown>)
        : (accounts.find((a) => a.active) as unknown as Record<string, unknown> | undefined);
    const user = normalizeClientUser(rawUser);
    if (!user) {
      return {
        status: 'anonymous',
        user: null,
        activeSlot: null,
        authuser,
        accounts,
      };
    }
    return { status: 'authenticated', user, activeSlot, authuser, accounts };
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    return {
      status: 'unavailable',
      user: null,
      activeSlot: null,
      authuser: effectiveAuthuser ?? 0,
      accounts: [],
      code: 'network',
      message: 'Could not reach Gothwad Accounts. Check your connection and try again.',
    };
  }
}

export async function fetchDirectAccountsSession(opts?: {
  signal?: AbortSignal;
  authuser?: number | null;
}): Promise<{
  user: GothwadUser;
  activeSlot: string | null;
  authuser: number;
  accounts: AccountSlotItem[];
} | null> {
  const result = await resolveDirectAccountsSession(opts);
  if (result.status !== 'authenticated') return null;
  return {
    user: result.user,
    activeSlot: result.activeSlot,
    authuser: result.authuser,
    accounts: result.accounts,
  };
}

/** Compatibility handler if an external or legacy flow redirects to `/auth/callback`. */
export async function handleOAuthCallback(): Promise<{ user: GothwadUser } | { error: string }> {
  const direct = await resolveDirectAccountsSession();
  if (direct.status === 'authenticated') return { user: direct.user };
  const p = new URLSearchParams(window.location.search);
  if (p.get('error')) return { error: p.get('error')! };
  const code = p.get('code');
  if (!code) {
    return { error: direct.status === 'unavailable' ? direct.code : 'missing_code' };
  }
  try {
    const res = await fetch(`${API_BASE}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        code,
        redirectUri: callbackRedirectUri(),
        codeVerifier: '',
      }),
    });
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

export async function fetchMe(): Promise<GothwadUser | null> {
  try {
    const res = await fetch(`${API_BASE}/me?light=1`, {
      credentials: 'include',
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.user) return normalizeClientUser(data.user) ?? data.user;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) {
      return null;
    }
  } catch {
    /* fall through to direct Accounts SSO */
  }
  const direct = await resolveDirectAccountsSession();
  return direct.status === 'authenticated' ? direct.user : null;
}

export async function signOutAccountSlot(
  slotOrAccount: string | { id?: string; slot?: string } | null | undefined,
  targetAccount?: { id?: string; slot?: string } | null,
): Promise<boolean> {
  const slotId = resolveSignOutSlotId(slotOrAccount, targetAccount);
  if (!slotId) return false;
  await signOut(slotId);
  return true;
}

export async function signOut(slotId?: string): Promise<void> {
  bumpAuthGeneration();
  const normalizedSlot = typeof slotId === 'string' ? slotId.trim() : '';
  const path = normalizedSlot
    ? `/auth/accounts/${encodeURIComponent(normalizedSlot)}/signout`
    : '/auth/signout';
  const payload = JSON.stringify(normalizedSlot ? { id: normalizedSlot } : {});
  const hdrs = { 'Content-Type': 'application/json', ...authHeaders() };
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: hdrs,
      body: payload,
    });
    if (!r.ok) throw new Error('worker_signout_failed');
  } catch {
    try {
      await fetch(`${accountsApiOrigin()}/api${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: hdrs,
        body: payload,
      });
    } catch {
      /* ignore */
    }
  }
  if (!normalizedSlot) {
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
