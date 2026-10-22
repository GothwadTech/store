// ── Worker API client ───────────────────────────────────────────────
// All frontend ↔ backend communication goes through /api/* on the Cloudflare
// Worker backed by Cloudflare D1 (`store`).
import { API_BASE } from './config';
import { authHeaders } from './auth';
import type {
  AccountSlotItem,
  AppRelease,
  Category,
  Developer,
  GothwadUser,
  ReportItem,
  Review,
  StoreApp,
  Submission,
} from '../types';

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
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

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
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      0,
      'network',
      'Could not reach the Store API. Check your connection and try again.',
    );
  }
  const data = await responseData(res);
  if (!res.ok) throw parseError(res.status, data, `Request failed (${res.status})`);
  return data as T;
}

interface XhrUploadOptions {
  timeoutMs?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * XMLHttpRequest is deliberate here: fetch still does not expose request-body
 * progress in browsers. APK/image uploads show actual bytes sent.
 */
function xhrJson(
  method: 'POST' | 'PUT',
  url: string,
  body: BodyInit | null,
  options: XhrUploadOptions = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      options.signal?.removeEventListener('abort', abort);
      callback();
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
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(Math.min(1, event.loaded / event.total));
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
      finish(() =>
        reject(
          new ApiError(
            0,
            'network',
            'The upload lost its network connection. Please try again.',
          ),
        ),
      );
    xhr.ontimeout = () =>
      finish(() =>
        reject(
          new ApiError(
            408,
            'timeout',
            'The upload took too long. Check your connection and try again.',
          ),
        ),
      );
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
  throw lastError instanceof Error
    ? lastError
    : new ApiError(0, 'upload_failed', 'Upload failed.');
}

export interface SessionInfo {
  user: GothwadUser;
  developer: Developer | null;
  isAdmin: boolean;
  d1Configured: boolean;
  activeSlot: string | null;
  authuser: number;
  accounts: AccountSlotItem[];
  accountUrl?: string;
}

export async function fetchSession(): Promise<SessionInfo | null> {
  try {
    const d = await request<{
      user: GothwadUser;
      developer: Developer | null;
      isAdmin: boolean;
      activeSlot?: string | null;
      activeId?: string | null;
      authuser?: number;
      accounts?: AccountSlotItem[];
      accountUrl?: string;
      configured?: { d1?: boolean; githubApk?: boolean };
    }>('/me');
    if (!d.user) return null;
    return {
      user: d.user,
      developer: d.developer ?? null,
      isAdmin: !!d.isAdmin,
      d1Configured: !!d.configured?.d1,
      activeSlot: d.activeSlot ?? d.activeId ?? null,
      authuser: typeof d.authuser === 'number' ? d.authuser : 0,
      accounts: Array.isArray(d.accounts) ? d.accounts : [],
      accountUrl: d.accountUrl,
    };
  } catch {
    return null;
  }
}

export const authApi = {
  accounts: () =>
    request<{
      authenticated: boolean;
      activeId: string | null;
      authuser: number;
      accounts: AccountSlotItem[];
    }>('/auth/accounts'),
  switchAccount: (payload: { id?: string; authuser?: number }) =>
    request<{ ok?: boolean; activeId?: string; authuser?: number }>('/auth/switch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  signOutSlot: (slotId: string) =>
    request<{ ok: boolean }>(`/auth/accounts/${encodeURIComponent(slotId)}/signout`, {
      method: 'POST',
      body: JSON.stringify({ id: slotId }),
    }),
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

/** Load live catalog records; never substitute local sample listings. */
export async function fetchCatalog(): Promise<Catalog> {
  try {
    const [appsRes, catRes] = await Promise.all([
      request<CatalogResponse>('/store/apps'),
      request<{ categories?: Category[]; source?: string }>('/store/categories'),
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
  } catch {
    return { status: 'unavailable', apps: [], releases: [], reviews: [], categories: [] };
  }
}

// ── User actions (login) ────────────────────────────────────────────
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
  libraryIds: () => request<{ appIds: string[] }>('/store/library'),
  wishlistIds: () => request<{ appIds: string[] }>('/store/wishlist'),
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
  register: (d: {
    displayName: string;
    orgName: string;
    supportEmail: string;
    website?: string;
  }) => request<{ developer: Developer }>('/dev/register', { method: 'POST', body: JSON.stringify(d) }),
  bundle: () => request<DevBundle>('/dev/apps'),
  createApp: (a: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>) =>
    request<{ app: StoreApp }>('/dev/apps', { method: 'POST', body: JSON.stringify(a) }),
  updateApp: (id: string, patch: Partial<StoreApp>) =>
    request<{ app: StoreApp }>(`/dev/apps/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  setStatus: (id: string, status: 'unlisted' | 'published') =>
    request<{ app: StoreApp }>(`/dev/apps/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
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

// ── Admin ───────────────────────────────────────────────────────────
export const adminApi = {
  queue: () =>
    request<{ submissions: Submission[]; apps: StoreApp[]; releases: AppRelease[] }>('/admin/queue'),
  apps: () =>
    request<{ apps: StoreApp[]; releases: AppRelease[]; submissions: Submission[] }>('/admin/apps'),
  reports: () => request<{ reports: ReportItem[] }>('/admin/reports'),
  decide: (submissionId: string, ok: boolean, note: string) =>
    request<{ submission: Submission }>(
      `/admin/submissions/${encodeURIComponent(submissionId)}/${ok ? 'approve' : 'reject'}`,
      { method: 'POST', body: JSON.stringify({ note }) },
    ),
  suspend: (appId: string) =>
    request<{ app: StoreApp }>(`/admin/apps/${encodeURIComponent(appId)}/suspend`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  restore: (appId: string) =>
    request<{ app: StoreApp }>(`/admin/apps/${encodeURIComponent(appId)}/restore`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
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
    return xhrJson('POST', apiUrl('/uploads/image'), form, {
      ...callbacks,
      timeoutMs: 90_000,
    }) as Promise<{ url?: string; error?: string; message?: string }>;
  });
  if (!result?.url) {
    throw new ApiError(
      502,
      result?.error ?? 'upload_failed',
      result?.message ?? 'Image upload failed. Please try again.',
    );
  }
  callbacks.onProgress?.(1);
  return result.url;
}

/** APK store kiye bina manifest auto-read (console form auto-fill). */
export async function inspectApk(
  file: File,
  signal?: AbortSignal,
): Promise<{ manifest: ApkManifestInfo; sizeBytes: number; sha256: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  const data = (await xhrJson('POST', apiUrl('/uploads/apk-inspect'), form, {
    timeoutMs: 120_000,
    signal,
  })) as {
    manifest?: ApkManifestInfo;
    sizeBytes?: number;
    sha256?: string;
    error?: string;
    message?: string;
  };
  if (!data?.manifest) {
    throw new ApiError(
      502,
      data?.error ?? 'inspect_failed',
      data?.message ?? 'APK inspection failed',
    );
  }
  return {
    manifest: data.manifest,
    sizeBytes: data.sizeBytes ?? file.size,
    sha256: data.sha256 ?? '',
  };
}

/**
 * APK upload flow: every supported APK goes through the Worker to GitHub
 * storefiles.
 */
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
    return xhrJson('POST', apiUrl('/uploads/apk'), form, {
      ...callbacks,
      timeoutMs: 10 * 60_000,
    }) as Promise<UploadedApk & { error?: string; message?: string }>;
  }, 2);
  if (!result?.url) {
    throw new ApiError(
      502,
      result?.error ?? 'upload_failed',
      result?.message ?? 'APK upload failed. Please try again.',
    );
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
