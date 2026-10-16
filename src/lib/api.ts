// ── Worker API client ───────────────────────────────────────────────
// All frontend ↔ backend communication goes through /api/*; the browser
// never connects directly to Supabase. This client reports unavailable data
// as such; AppContext enables sample fallbacks only on non-production hosts.
import { API_BASE } from './config';
import { authHeaders } from './auth';
import type { AppRelease, Category, Developer, GothwadUser, ReportItem, Review, StoreApp, Submission } from '../types';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the Store API');
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, d.error ?? 'request_failed', d.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export interface SessionInfo {
  user: GothwadUser;
  developer: Developer | null;
  isAdmin: boolean;
  supabaseConfigured: boolean;
}

export async function fetchSession(): Promise<SessionInfo | null> {
  try {
    const d = await request<{ user: GothwadUser; developer: Developer | null; isAdmin: boolean; configured?: { supabase?: boolean } }>('/me');
    if (!d.user) return null;
    return { user: d.user, developer: d.developer ?? null, isAdmin: !!d.isAdmin, supabaseConfigured: !!d.configured?.supabase };
  } catch {
    return null;
  }
}

export type CatalogStatus = 'ready' | 'unconfigured' | 'unavailable';

export interface Catalog {
  status: CatalogStatus;
  apps: StoreApp[];
  releases: AppRelease[];
  reviews: Review[];
  categories: Category[];
}

interface CatalogResponse { apps?: StoreApp[]; releases?: AppRelease[]; reviews?: Review[]; source?: string }

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
    request<{ review: Review }>(`/store/apps/${encodeURIComponent(appId)}/reviews`, { method: 'POST', body: JSON.stringify({ rating, body }) }),
  setWishlist: (appId: string, on: boolean) =>
    request<{ ok: boolean }>(`/store/apps/${encodeURIComponent(appId)}/wishlist`, { method: on ? 'POST' : 'DELETE' }),
  report: (appId: string, reason: string, details: string) =>
    request<{ report: ReportItem }>(`/store/apps/${encodeURIComponent(appId)}/report`, { method: 'POST', body: JSON.stringify({ reason, details }) }),
  touchLibrary: (appId: string, versionCode?: number) =>
    request<{ ok: boolean }>(`/store/apps/${encodeURIComponent(appId)}/library`, { method: 'POST', body: JSON.stringify({ versionCode }) }),
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
  register: (d: { displayName: string; orgName: string; supportEmail: string; website?: string }) =>
    request<{ developer: Developer }>('/dev/register', { method: 'POST', body: JSON.stringify(d) }),
  bundle: () => request<DevBundle>('/dev/apps'),
  createApp: (a: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>) =>
    request<{ app: StoreApp }>('/dev/apps', { method: 'POST', body: JSON.stringify(a) }),
  updateApp: (id: string, patch: Partial<StoreApp>) =>
    request<{ app: StoreApp }>(`/dev/apps/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  setStatus: (id: string, status: 'unlisted' | 'published') =>
    request<{ app: StoreApp }>(`/dev/apps/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createRelease: (appId: string, payload: unknown) =>
    request<{ release: AppRelease }>(`/dev/apps/${encodeURIComponent(appId)}/releases`, { method: 'POST', body: JSON.stringify(payload) }),
  submit: (appId: string, releaseId: string) =>
    request<{ submission: Submission }>(`/dev/apps/${encodeURIComponent(appId)}/releases/${encodeURIComponent(releaseId)}/submit`, { method: 'POST', body: JSON.stringify({}) }),
  reply: (appId: string, reviewId: string, reply: string) =>
    request<{ review: Review }>(`/dev/apps/${encodeURIComponent(appId)}/reviews/${encodeURIComponent(reviewId)}/reply`, { method: 'POST', body: JSON.stringify({ reply }) }),
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
  queue: () => request<{ submissions: Submission[]; apps: StoreApp[]; releases: AppRelease[] }>('/admin/queue'),
  apps: () => request<{ apps: StoreApp[]; releases: AppRelease[]; submissions: Submission[] }>('/admin/apps'),
  reports: () => request<{ reports: ReportItem[] }>('/admin/reports'),
  decide: (submissionId: string, ok: boolean, note: string) =>
    request<{ submission: Submission }>(`/admin/submissions/${encodeURIComponent(submissionId)}/${ok ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ note }) }),
  suspend: (appId: string) => request<{ app: StoreApp }>(`/admin/apps/${encodeURIComponent(appId)}/suspend`, { method: 'POST', body: JSON.stringify({}) }),
  restore: (appId: string) => request<{ app: StoreApp }>(`/admin/apps/${encodeURIComponent(appId)}/restore`, { method: 'POST', body: JSON.stringify({}) }),
  resolveReport: (reportId: string, status: 'resolved' | 'dismissed') =>
    request<{ report: ReportItem }>(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, { method: 'POST', body: JSON.stringify({ status }) }),
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
  provider: 'github' | 'b2';
  url: string;
  key: string;
  sizeBytes: number;
  sha256?: string;
  manifest?: ApkManifestInfo;
}

/** Image → Worker → ImgBB. Compressed Blob bhej sakte ho (compressImage ke baad). */
export async function uploadImage(image: Blob, fileName = 'image.webp'): Promise<string> {
  const form = new FormData();
  form.append('image', image, fileName);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/uploads/image`, { method: 'POST', credentials: 'include', headers: authHeaders(), body: form });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the Store API');
  }
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string; message?: string } | null;
  if (!res.ok || !data?.url) throw new ApiError(res.status, data?.error ?? 'upload_failed', data?.message ?? 'Image upload failed');
  return data.url;
}

/** APK store kiye bina manifest auto-read (console form auto-fill). */
export async function inspectApk(file: File): Promise<{ manifest: ApkManifestInfo; sizeBytes: number; sha256: string }> {
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(`${API_BASE}/uploads/apk-inspect`, { method: 'POST', credentials: 'include', headers: authHeaders(), body: form });
  const data = (await res.json().catch(() => null)) as { manifest?: ApkManifestInfo; sizeBytes?: number; sha256?: string; error?: string; message?: string } | null;
  if (!res.ok || !data?.manifest) throw new ApiError(res.status, data?.error ?? 'inspect_failed', data?.message ?? 'APK inspection failed');
  return { manifest: data.manifest, sizeBytes: data.sizeBytes ?? file.size, sha256: data.sha256 ?? '' };
}

/**
 * Poora APK upload flow (pakka rule):
 *  ≤25 MB → Worker se GitHub storefiles;  >25 MB → B2 presigned PUT (direct).
 * onProgress(0..1) dono raaston par best-effort milta hai.
 */
export async function uploadApk(
  file: File,
  app: { packageName: string },
  versionCode: number,
  onProgress?: (fraction: number) => void,
): Promise<UploadedApk> {
  const ticket = await request<{ provider: 'github' | 'b2'; mode: string; uploadUrl: string; publicUrl?: string; key?: string }>('/uploads/apk-ticket', {
    method: 'POST',
    body: JSON.stringify({ packageName: app.packageName, versionCode, fileName: file.name, sizeBytes: file.size, contentType: file.type || 'application/vnd.android.package-archive' }),
  });

  if (ticket.provider === 'b2') {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', ticket.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/vnd.android.package-archive');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, 'b2_upload_failed', 'Backblaze B2 upload failed')));
      xhr.onerror = () => reject(new ApiError(0, 'network', 'Backblaze B2 upload failed'));
      xhr.send(file);
    });
    onProgress?.(1);
    return { provider: 'b2', url: ticket.publicUrl ?? ticket.uploadUrl.split('?')[0], key: ticket.key ?? '', sizeBytes: file.size };
  }

  // GitHub raasta: Worker khud storefiles Releases me daalta hai.
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('packageName', app.packageName);
  form.append('versionCode', String(versionCode));
  const res = await fetch(`${API_BASE}/uploads/apk`, { method: 'POST', credentials: 'include', headers: authHeaders(), body: form });
  const data = (await res.json().catch(() => null)) as (UploadedApk & { error?: string; message?: string }) | null;
  if (!res.ok || !data?.url) throw new ApiError(res.status, data?.error ?? 'upload_failed', data?.message ?? 'APK upload failed');
  onProgress?.(1);
  return { provider: 'github', url: data.url, key: data.key, sizeBytes: data.sizeBytes ?? file.size, sha256: data.sha256, manifest: data.manifest };
}
