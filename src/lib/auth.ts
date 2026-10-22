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

export function buildSignInUrl(opts?: {
  nextUrl?: string;
  choose?: boolean;
  add?: boolean;
  authuser?: number | null;
}): string {
  const base = accountsWebOrigin();
  const next =
    opts?.nextUrl ||
    (typeof window !== 'undefined' && window.location?.href ? window.location.href : SITE_URLS.store);
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

export function normalizeClientUser(raw: Record<string, unknown> | null | undefined): GothwadUser | null {
  if (!raw || typeof raw !== 'object') return null;
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

/** Direct browser silent SSO check against Gothwad Accounts API (`/api/auth/me`). */
export async function fetchDirectAccountsSession(): Promise<{
  user: GothwadUser;
  activeSlot: string | null;
  authuser: number;
  accounts: AccountSlotItem[];
} | null> {
  try {
    const res = await fetch(`${accountsApiOrigin()}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json', ...authHeaders() },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, unknown>;
    if (d.authenticated === false) return null;
    const activeSlot =
      typeof d.activeId === 'string'
        ? d.activeId
        : typeof d.activeSlot === 'string'
          ? d.activeSlot
          : null;
    const authuser = typeof d.authuser === 'number' ? d.authuser : (getActiveAuthuser() ?? 0);
    const accounts = normalizeClientAccounts(d.accounts, activeSlot);
    const rawUser =
      d.user && typeof d.user === 'object'
        ? (d.user as Record<string, unknown>)
        : (accounts.find((a) => a.active) as unknown as Record<string, unknown> | undefined);
    const user = normalizeClientUser(rawUser);
    if (!user) return null;
    return { user, activeSlot, authuser, accounts };
  } catch {
    return null;
  }
}

/** Compatibility handler if an external or legacy flow redirects to `/auth/callback`. */
export async function handleOAuthCallback(): Promise<{ user: GothwadUser } | { error: string }> {
  const direct = await fetchDirectAccountsSession();
  if (direct?.user) return { user: direct.user };
  const p = new URLSearchParams(window.location.search);
  if (p.get('error')) return { error: p.get('error')! };
  const code = p.get('code');
  if (!code) return { error: 'missing_code' };
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
    const res = await fetch(`${API_BASE}/me`, { credentials: 'include', headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data?.user) return data.user;
    }
  } catch {
    /* fall through to direct Accounts SSO */
  }
  const direct = await fetchDirectAccountsSession();
  return direct?.user ?? null;
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
