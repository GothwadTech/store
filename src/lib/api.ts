// ── Worker API client ───────────────────────────────────────────────
// All frontend ↔ backend communication goes through /api/* on the Cloudflare
// Worker backed by Cloudflare D1 (`store`).
import { API_BASE } from './config';
import {
  accountsApiOrigin,
  authHeaders,
  fetchDirectAccountsSession,
  resolveDirectAccountsSession,
} from './auth';
import {
  clearInflightSessions,
  fetchSession,
  resolveSessionState,
  type DeveloperResolutionStatus,
  type PermissionResolutionStatus,
  type SessionInfo,
  type SessionResolutionResult,
  type SessionResolutionStatus,
} from './sessionClient';
import type {
  AccountSlotItem,
  AppRelease,
  Category,
  Developer,
  ReportItem,
  Review,
  StoreApp,
  Submission,
} from '../types';

export {
  clearInflightSessions,
  fetchDirectAccountsSession,
  fetchSession,
  resolveDirectAccountsSession,
  resolveSessionState,
  type DeveloperResolutionStatus,
  type PermissionResolutionStatus,
  type SessionInfo,
  type SessionResolutionResult,
  type SessionResolutionStatus,
};

export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable =
      status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
  }
}

const RETRYABLE_STATUS = new Set([0, 408, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const apiUrl = (path: string): string => `${API_BASE}${path}`;

function parseError(status: number, data: unknown, fallback: string): ApiError {
  const body = (data ?? {}) as { error?: string; message?: string };
  return new ApiError(status, body.error ?? 'request_failed', body.message ?? fallback);
}

async function responseData(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) },
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Could not reach the Store API. Check your connection and try again.');
  }
  const data = await responseData(res);
  if (!res.ok) throw parseError(res.status, data, `Request failed (${res.status})`);
  if (data === null || typeof data !== 'object') {
    throw new ApiError(502, 'invalid_response', 'Received an unexpected response from the Store API.');
  }
  return data as T;
}

interface XhrUploadOptions {
  timeoutMs?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** XMLHttpRequest is used deliberately so APK and image uploads report byte progress. */
function xhrJson(
  method: 'POST' | 'PUT',
  url: string,
  body: BodyInit | null,
  options: XhrUploadOptions = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let finished = false;
    const finish = (cb: () => void) => {
      if (finished) return;
      finished = true;
      options.signal?.removeEventListener('abort', abort);
      cb();
    };
    const abort = () => {
      try {
        xhr.abort();
      } catch {
        /* no-op */
      }
      finish(() => reject(new ApiError(0, 'aborted', 'Upload cancelled.')));
    };

    xhr.open(method, url);
    xhr.withCredentials = true;
    xhr.timeout = options.timeoutMs ?? 180_000;
    for (const [header, value] of Object.entries(authHeaders())) {
      xhr.setRequestHeader(header, value);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        options.onProgress?.(Math.min(1, e.loaded / e.total));
      }
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300) finish(() => resolve(data));
      else finish(() => reject(parseError(xhr.status, data, `Upload failed (${xhr.status})`)));
    };
    xhr.onerror = () =>
      finish(() => reject(new ApiError(0, 'network', 'The upload lost its network connection. Please try again.')));
    xhr.ontimeout = () =>
      finish(() => reject(new ApiError(408, 'timeout', 'The upload took too long. Check your connection and try again.')));
    xhr.onabort = () => finish(() => reject(new ApiError(0, 'aborted', 'Upload cancelled.')));
    options.signal?.addEventListener('abort', abort, { once: true });
    xhr.send(body as XMLHttpRequestBodyInit | null);
  });
}

async function retryUpload<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      const status = error instanceof ApiError ? error.status : 0;
      if (!RETRYABLE_STATUS.has(status) || attempt === attempts - 1) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new ApiError(0, 'upload_failed', 'Upload failed.');
}

export const authApi = {
  accounts: async () => {
    try {
      return await request<{ authenticated: boolean; activeId: string | null; authuser: number; accounts: AccountSlotItem[] }>('/auth/accounts');
    } catch {
      const direct = await resolveDirectAccountsSession();
      return {
        authenticated: direct.status === 'authenticated',
        activeId: direct.activeSlot,
        authuser: direct.authuser,
        accounts: direct.accounts,
      };
    }
  },
  switchAccount: async (payload: { id?: string; authuser?: number }) => {
    try {
      return await request<{ ok?: boolean; activeId?: string; authuser?: number }>('/auth/switch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 429)) {
        throw err;
      }
      let r: Response;
      try {
        r = await fetch(`${accountsApiOrigin()}/api/auth/switch`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new ApiError(0, 'network', 'Could not switch accounts. Check your connection and try again.');
      }
      const data = await responseData(r);
      if (!r.ok) throw parseError(r.status, data, `Account switch failed (${r.status})`);
      return (data ?? { ok: true }) as { ok?: boolean; activeId?: string; authuser?: number };
    }
  },
  signOutSlot: async (slotId: string) => {
    const trimmed = typeof slotId === 'string' ? slotId.trim() : '';
    if (!trimmed) return { ok: false };
    try {
      return await request<{ ok: boolean }>(`/auth/accounts/${encodeURIComponent(trimmed)}/signout`, {
        method: 'POST',
        body: JSON.stringify({ id: trimmed }),
      });
    } catch {
      await fetch(`${accountsApiOrigin()}/api/auth/accounts/${encodeURIComponent(trimmed)}/signout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: trimmed }),
      });
      return { ok: true };
    }
  },
};

export type CatalogStatus = 'ready' | 'unconfigured' | 'unavailable';

export interface Catalog {
  status: CatalogStatus;
  apps: StoreApp[];
  releases: AppRelease[];
  reviews: Review[];
  categories: Category[];
}

interface CatalogResponse {
  apps?: StoreApp[];
  releases?: AppRelease[];
  reviews?: Review[];
  source?: string;
}

/** Load live catalog records (Kiwi Store D1 + F-Droid Open Source); never substitute local sample listings. */
export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  try {
    const [appsRes, catRes] = await Promise.all([
      request<CatalogResponse>('/store/apps?fdroid=1', { signal }),
      request<{ categories?: Category[]; source?: string }>('/store/categories', { signal }),
    ]);
    if (appsRes.source === 'unconfigured' || catRes.source === 'unconfigured') {
      return { status: 'unconfigured', apps: [], releases: [], reviews: [], categories: [] };
    }
    return {
      status: 'ready',
      apps: appsRes.apps ?? [],
      releases: appsRes.releases ?? [],
      reviews: appsRes.reviews ?? [],
      categories: catRes.categories ?? [],
    };
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    return { status: 'unavailable', apps: [], releases: [], reviews: [], categories: [] };
  }
}

export async function searchFdroid(query: string): Promise<{ apps: StoreApp[]; releases: AppRelease[] }> {
  try {
    const d = await request<CatalogResponse>(`/store/fdroid?q=${encodeURIComponent(query.trim())}`);
    return { apps: d.apps ?? [], releases: d.releases ?? [] };
  } catch {
    return { apps: [], releases: [] };
  }
}

export async function fetchAppDetail(idOrPkg: string): Promise<{
  app: StoreApp;
  screenshots: string[];
  liveRelease: AppRelease | null;
  releases: AppRelease[];
  reviews: Review[];
} | null> {
  try {
    return await request(`/store/apps/${encodeURIComponent(idOrPkg)}`);
  } catch {
    return null;
  }
}

// ── User actions (signed-in) ────────────────────────────────────────
export const userApi = {
  addReview: (appId: string, rating: number, body: string) =>
    request<{ review: Review }>(`/store/apps/${encodeURIComponent(appId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, body }),
    }),
  setWishlist: (appId: string, on: boolean) =>
    request<{ ok: boolean }>(`/store/apps/${encodeURIComponent(appId)}/wishlist`, {
      method: on ? 'POST' : 'DELETE',
    }),
  report: (appId: string, reason: string, details: string) =>
    request<{ report: ReportItem }>(`/store/apps/${encodeURIComponent(appId)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, details }),
    }),
  touchLibrary: (appId: string, versionCode?: number) =>
    request<{ ok: boolean }>(`/store/apps/${encodeURIComponent(appId)}/library`, {
      method: 'POST',
      body: JSON.stringify({ versionCode }),
    }),
  libraryIds: (signal?: AbortSignal) => request<{ appIds: string[] }>('/store/library', { signal }),
  wishlistIds: (signal?: AbortSignal) => request<{ appIds: string[] }>('/store/wishlist', { signal }),
};

// ── Developer console ───────────────────────────────────────────────
export interface DevBundle {
  developer: Developer;
  apps: StoreApp[];
  releases: AppRelease[];
  reviews: Review[];
  submissions: Submission[];
}

export const devApi = {
  register: (d: { displayName: string; orgName: string; supportEmail: string; website?: string }) =>
    request<{ developer: Developer }>('/dev/register', { method: 'POST', body: JSON.stringify(d) }),
  bundle: (signal?: AbortSignal) => request<DevBundle>('/dev/apps', { signal }),
  createApp: (a: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>) =>
    request<{ app: StoreApp }>('/dev/apps', { method: 'POST', body: JSON.stringify(a) }),
  updateApp: (id: string, patch: Partial<StoreApp>) =>
    request<{ app: StoreApp }>(`/dev/apps/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  setStatus: (id: string, status: 'unlisted' | 'published') =>
    request<{ app: StoreApp }>(`/dev/apps/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createRelease: (appId: string, payload: unknown) =>
    request<{ release: AppRelease }>(`/dev/apps/${encodeURIComponent(appId)}/releases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submit: (appId: string, releaseId: string) =>
    request<{ submission: Submission }>(
      `/dev/apps/${encodeURIComponent(appId)}/releases/${encodeURIComponent(releaseId)}/submit`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  reply: (appId: string, reviewId: string, reply: string) =>
    request<{ review: Review }>(
      `/dev/apps/${encodeURIComponent(appId)}/reviews/${encodeURIComponent(reviewId)}/reply`,
      { method: 'POST', body: JSON.stringify({ reply }) },
    ),
  stats: (appId: string, days = 7) =>
    request<{
      days: { date: string; count: number }[];
      totalDownloads: number;
      ratingAvg: number;
      ratingCount: number;
    }>(`/dev/apps/${encodeURIComponent(appId)}/stats?days=${days}`),
};

// ── Admin moderation ────────────────────────────────────────────────
export const adminApi = {
  queue: (signal?: AbortSignal) => request<{ submissions: Submission[]; apps: StoreApp[]; releases: AppRelease[] }>('/admin/queue', { signal }),
  apps: (signal?: AbortSignal) => request<{ apps: StoreApp[]; releases: AppRelease[]; submissions: Submission[] }>('/admin/apps', { signal }),
  reports: (signal?: AbortSignal) => request<{ reports: ReportItem[] }>('/admin/reports', { signal }),
  decide: (submissionId: string, ok: boolean, note: string) =>
    request<{ submission: Submission }>(
      `/admin/submissions/${encodeURIComponent(submissionId)}/${ok ? 'approve' : 'reject'}`,
      { method: 'POST', body: JSON.stringify({ note }) },
    ),
  suspend: (appId: string) =>
    request<{ app: StoreApp }>(`/admin/apps/${encodeURIComponent(appId)}/suspend`, { method: 'POST', body: JSON.stringify({}) }),
  restore: (appId: string) =>
    request<{ app: StoreApp }>(`/admin/apps/${encodeURIComponent(appId)}/restore`, { method: 'POST', body: JSON.stringify({}) }),
  resolveReport: (reportId: string, status: 'resolved' | 'dismissed') =>
    request<{ report: ReportItem }>(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
};

// ── Uploads ─────────────────────────────────────────────────────────
export interface ApkManifestInfo {
  packageName: string | null;
  versionCode: number | null;
  versionName: string | null;
  minSdk: number | null;
  targetSdk: number | null;
  permissions: string[];
}

export interface UploadedApk {
  provider: 'github';
  url: string;
  key: string;
  sizeBytes: number;
  sha256?: string;
  manifest?: ApkManifestInfo;
}

export interface UploadCallbacks {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  appId?: string;
  purpose?: 'icon' | 'screenshot' | 'banner';
  kind?: 'icon' | 'screenshot' | 'banner';
}

/** Image → Worker → Cloudflare D1 `store_images` + Edge Cache (`/api/images/:id`). */
export async function uploadImage(
  image: Blob,
  fileName = 'image.webp',
  callbacks: UploadCallbacks = {},
): Promise<string> {
  const result = await retryUpload(async () => {
    const form = new FormData();
    form.append('image', image, fileName.replace(/\.[^.]+$/, '') + '.webp');
    const kind = callbacks.kind ?? callbacks.purpose;
    if (kind) form.append('kind', kind);
    return xhrJson('POST', apiUrl('/uploads/image'), form, { ...callbacks, timeoutMs: 90_000 }) as Promise<{
      url?: string;
      error?: string;
      message?: string;
    }>;
  });
  if (!result?.url) {
    throw new ApiError(502, result?.error ?? 'upload_failed', result?.message ?? 'Image upload failed. Please try again.');
  }
  callbacks.onProgress?.(1);
  return result.url;
}

/** Inspect binary APK manifest without saving the release yet (console form auto-fill). */
export async function inspectApk(
  file: File,
  signal?: AbortSignal,
): Promise<{ manifest: ApkManifestInfo; sizeBytes: number; sha256: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  const data = (await xhrJson('POST', apiUrl('/uploads/apk-inspect'), form, { timeoutMs: 120_000, signal })) as {
    manifest?: ApkManifestInfo;
    sizeBytes?: number;
    sha256?: string;
    error?: string;
    message?: string;
  };
  if (!data?.manifest) {
    throw new ApiError(502, data?.error ?? 'inspect_failed', data?.message ?? 'APK inspection failed');
  }
  return { manifest: data.manifest, sizeBytes: data.sizeBytes ?? file.size, sha256: data.sha256 ?? '' };
}

/** APK upload flow: every supported APK goes through the Worker to GitHub storefiles. */
export async function uploadApk(
  file: File,
  app: { packageName: string },
  versionCode: number,
  callbacks: UploadCallbacks = {},
): Promise<UploadedApk> {
  callbacks.onProgress?.(0);
  const result = await retryUpload(async () => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('packageName', app.packageName);
    form.append('versionCode', String(versionCode));
    return xhrJson('POST', apiUrl('/uploads/apk'), form, { ...callbacks, timeoutMs: 10 * 60_000 }) as Promise<
      UploadedApk & { error?: string; message?: string }
    >;
  }, 2);
  if (!result?.url) {
    throw new ApiError(502, result?.error ?? 'upload_failed', result?.message ?? 'APK upload failed. Please try again.');
  }
  callbacks.onProgress?.(1);
  return {
    provider: 'github',
    url: result.url,
    key: result.key,
    sizeBytes: result.sizeBytes ?? file.size,
    sha256: result.sha256,
    manifest: result.manifest,
  };
}
