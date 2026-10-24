// Session resolution, deduplication, and multi-account switcher client helpers
import { API_BASE } from './config';
import {
  accountsApiOrigin,
  authHeaders,
  fetchDirectAccountsSession,
  getActiveAuthuser,
  getAuthGeneration,
  manageAccountUrl,
  normalizeClientAccounts,
  normalizeClientUser,
  resolveDirectAccountsSession,
} from './auth';
import type { AccountSlotItem, Developer, GothwadUser } from '../types';

export { fetchDirectAccountsSession, resolveDirectAccountsSession };

export type SessionResolutionStatus = 'authenticated' | 'anonymous' | 'unavailable';
export type PermissionResolutionStatus = 'ready' | 'loading' | 'unavailable';
export type DeveloperResolutionStatus = 'ready' | 'none' | 'loading' | 'unavailable';

export interface SessionResolutionResult {
  status: SessionResolutionStatus;
  user: GothwadUser | null;
  developer: Developer | null;
  developerStatus: DeveloperResolutionStatus;
  isAdmin: boolean | null;
  permissionsStatus: PermissionResolutionStatus;
  d1Configured: boolean;
  activeSlot: string | null;
  authuser: number;
  accounts: AccountSlotItem[];
  accountUrl?: string;
  source: 'worker' | 'accounts-fallback' | 'none';
  errorCode?: string;
  errorMessage?: string;
}

export interface SessionInfo {
  user: GothwadUser;
  developer: Developer | null;
  developerStatus?: DeveloperResolutionStatus;
  isAdmin: boolean;
  permissionsStatus?: PermissionResolutionStatus;
  d1Configured: boolean;
  activeSlot: string | null;
  authuser: number;
  accounts: AccountSlotItem[];
  accountUrl?: string;
  source?: 'worker' | 'accounts-fallback' | 'none';
}

const inflightSessionByKey = new Map<string, Promise<SessionResolutionResult>>();

export function clearInflightSessions(): void {
  inflightSessionByKey.clear();
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function performSessionResolution(opts?: {
  light?: boolean;
  authuser?: number | null;
  signal?: AbortSignal;
}): Promise<SessionResolutionResult> {
  const effectiveAuthuser = opts?.authuser !== undefined ? opts.authuser : getActiveAuthuser();
  const fallbackAuthuser = effectiveAuthuser ?? 0;
  const endpoint = opts?.light ? `${API_BASE}/me?light=1` : `${API_BASE}/me`;

  let workerRes: Response | null = null;
  let workerData: Record<string, unknown> | null = null;
  try {
    workerRes = await fetch(endpoint, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: opts?.signal,
      headers: { Accept: 'application/json', ...authHeaders(effectiveAuthuser) },
    });
    workerData = await parseJsonSafe(workerRes);
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    workerRes = null;
  }

  if (workerRes) {
    if (workerRes.status === 200 && workerData) {
      const activeSlot =
        typeof workerData.activeSlot === 'string'
          ? workerData.activeSlot
          : typeof workerData.activeId === 'string'
            ? workerData.activeId
            : null;
      const authuser =
        typeof workerData.authuser === 'number' ? workerData.authuser : fallbackAuthuser;
      const accounts = Array.isArray(workerData.accounts)
        ? normalizeClientAccounts(workerData.accounts, activeSlot)
        : [];
      const rawUser =
        workerData.authenticated !== false && workerData.user && typeof workerData.user === 'object'
          ? (workerData.user as Record<string, unknown>)
          : null;
      const user = rawUser ? (normalizeClientUser(rawUser) ?? (rawUser as unknown as GothwadUser)) : null;

      if (!user) {
        return {
          status: 'anonymous',
          user: null,
          developer: null,
          developerStatus: 'none',
          isAdmin: false,
          permissionsStatus: 'ready',
          d1Configured: Boolean((workerData.configured as { d1?: boolean } | undefined)?.d1),
          activeSlot: null,
          authuser,
          accounts,
          source: 'worker',
        };
      }

      const devObj =
        workerData.developer && typeof workerData.developer === 'object'
          ? (workerData.developer as Developer)
          : null;
      const rawDevStatus = workerData.developerStatus;
      const developerStatus: DeveloperResolutionStatus =
        rawDevStatus === 'deferred'
          ? 'loading'
          : rawDevStatus === 'unavailable'
            ? 'unavailable'
            : devObj
              ? 'ready'
              : 'none';

      return {
        status: 'authenticated',
        user,
        developer: devObj,
        developerStatus,
        isAdmin: Boolean(workerData.isAdmin),
        permissionsStatus: 'ready',
        d1Configured: Boolean((workerData.configured as { d1?: boolean } | undefined)?.d1),
        activeSlot,
        authuser,
        accounts,
        accountUrl:
          typeof workerData.accountUrl === 'string'
            ? workerData.accountUrl
            : manageAccountUrl(authuser),
        source: 'worker',
      };
    }

    // Authoritative anonymous response from Store Worker: do NOT fire a redundant fallback request
    if (
      (workerRes.status === 401 || workerRes.status === 403) &&
      workerData &&
      (workerData.error === 'unauthorized' || workerData.authenticated === false)
    ) {
      return {
        status: 'anonymous',
        user: null,
        developer: null,
        developerStatus: 'none',
        isAdmin: false,
        permissionsStatus: 'ready',
        d1Configured: false,
        activeSlot: null,
        authuser: typeof workerData.authuser === 'number' ? workerData.authuser : fallbackAuthuser,
        accounts: [],
        source: 'worker',
      };
    }

    if (workerRes.status === 429) {
      return {
        status: 'unavailable',
        user: null,
        developer: null,
        developerStatus: 'unavailable',
        isAdmin: null,
        permissionsStatus: 'unavailable',
        d1Configured: false,
        activeSlot: null,
        authuser: fallbackAuthuser,
        accounts: [],
        source: 'worker',
        errorCode: 'rate_limited',
        errorMessage: 'Too many authentication requests. Please wait a moment and try again.',
      };
    }

    // Store Worker reached out to Accounts and Accounts returned 5xx/timeout: do NOT hammer Accounts again
    if (workerRes.status === 503 && workerData?.error === 'auth_unavailable') {
      return {
        status: 'unavailable',
        user: null,
        developer: null,
        developerStatus: 'unavailable',
        isAdmin: null,
        permissionsStatus: 'unavailable',
        d1Configured: false,
        activeSlot: null,
        authuser: fallbackAuthuser,
        accounts: [],
        source: 'worker',
        errorCode: 'auth_unavailable',
        errorMessage:
          typeof workerData.message === 'string'
            ? workerData.message
            : 'Gothwad Accounts service is temporarily unavailable.',
      };
    }
  }

  // Fallback to direct Gothwad Accounts SSO only when Store Worker was unreachable or returned HTML/5xx
  const direct = await resolveDirectAccountsSession({
    signal: opts?.signal,
    authuser: effectiveAuthuser,
  });
  if (direct.status === 'authenticated') {
    return {
      status: 'authenticated',
      user: direct.user,
      developer: null,
      developerStatus: 'unavailable',
      isAdmin: null,
      permissionsStatus: 'unavailable',
      d1Configured: false,
      activeSlot: direct.activeSlot,
      authuser: direct.authuser,
      accounts: direct.accounts,
      accountUrl: manageAccountUrl(direct.authuser),
      source: 'accounts-fallback',
      errorCode: 'store_permissions_unavailable',
      errorMessage: 'Signed in via Gothwad Accounts, but the Store service is currently unavailable.',
    };
  }
  if (direct.status === 'anonymous') {
    return {
      status: 'anonymous',
      user: null,
      developer: null,
      developerStatus: 'none',
      isAdmin: false,
      permissionsStatus: 'ready',
      d1Configured: false,
      activeSlot: null,
      authuser: direct.authuser,
      accounts: direct.accounts,
      source: 'accounts-fallback',
    };
  }
  return {
    status: 'unavailable',
    user: null,
    developer: null,
    developerStatus: 'unavailable',
    isAdmin: null,
    permissionsStatus: 'unavailable',
    d1Configured: false,
    activeSlot: null,
    authuser: fallbackAuthuser,
    accounts: [],
    source: 'none',
    errorCode: direct.code,
    errorMessage: direct.message,
  };
}

export function resolveSessionState(opts?: {
  light?: boolean;
  authuser?: number | null;
  signal?: AbortSignal;
  force?: boolean;
}): Promise<SessionResolutionResult> {
  const effectiveAuthuser = opts?.authuser !== undefined ? opts.authuser : getActiveAuthuser();
  const gen = getAuthGeneration();
  const key = `${gen}:${effectiveAuthuser ?? 'default'}:${opts?.light ? 'light' : 'full'}`;
  if (!opts?.force && !opts?.signal) {
    const existing = inflightSessionByKey.get(key);
    if (existing) return existing;
  }
  const promise = performSessionResolution(opts).finally(() => {
    if (inflightSessionByKey.get(key) === promise) {
      inflightSessionByKey.delete(key);
    }
  });
  if (!opts?.signal) {
    inflightSessionByKey.set(key, promise);
  }
  return promise;
}

export async function fetchSession(opts?: {
  light?: boolean;
  authuser?: number | null;
  signal?: AbortSignal;
  force?: boolean;
}): Promise<SessionInfo | null> {
  const res = await resolveSessionState(opts);
  if (res.status !== 'authenticated' || !res.user) return null;
  return {
    user: res.user,
    developer: res.developer,
    developerStatus: res.developerStatus,
    isAdmin: Boolean(res.isAdmin),
    permissionsStatus: res.permissionsStatus,
    d1Configured: res.d1Configured,
    activeSlot: res.activeSlot,
    authuser: res.authuser,
    accounts: res.accounts,
    accountUrl: res.accountUrl,
    source: res.source,
  };
}

export { accountsApiOrigin };
