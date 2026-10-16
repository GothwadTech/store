// ═══════════════════════════════════════════════════════════════════
// GOTHWAD STORE WORKER - ek hi API chaaro cheezon ke liye:
//   store.gothwadtech.com · console.gothwadtech.com
//   storeadmin.gothwadtech.com · storeapp.gothwadtech.com · Android app
//
// Pakke niyam (PLAN.md):
//  · Supabase = Store ka APNA project, SIRF database (Storage bilkul nahi)
//  · Images  -> ImgBB            (IMGBB_API_KEY)
//  · APK <=25MB -> GitHub store-files repo   (GITHUB_FILES_TOKEN)
//  · APK  >25MB -> Backblaze B2 (S3 API)     (B2_KEY_ID/B2_APP_KEY)
//  · Login   -> Gothwad Accounts OAuth/cookie (khud ka password system NAHI)
//  · SERVICE ROLE KEY sirf yahi rahegi, frontend me kabhi nahi
//  · Har APK manual review ke baad hi live hoga (draft → in_review → published)
// ═══════════════════════════════════════════════════════════════════

import { parseApkManifest, sha256Hex } from './apk';

interface Env {
  APP_DOMAIN: string;
  STORE_URL: string;
  CONSOLE_URL: string;
  ADMIN_URL: string;
  STOREAPP_URL: string;
  AUTH_HUB_URL: string;
  AUTH_SIGNIN_URL: string;
  OAUTH_CLIENT_ID: string;
  SUPABASE_URL: string;
  ADMIN_USERNAMES: string;
  GITHUB_FILES_OWNER: string;
  GITHUB_FILES_REPO: string;
  B2_S3_ENDPOINT: string;
  B2_BUCKET: string;
  B2_PUBLIC_BASE: string;
  ALLOWED_ORIGINS: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  IMGBB_API_KEY?: string;
  GITHUB_FILES_TOKEN?: string;
  B2_KEY_ID?: string;
  B2_APP_KEY?: string;
}

const APK_GITHUB_LIMIT = 25 * 1024 * 1024; // src/lib/storage.ts ke saath sync rakho

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const err = (code: string, message: string, status = 400) => json({ error: code, message }, status);

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = [
    env.STORE_URL, env.CONSOLE_URL, env.ADMIN_URL, env.STOREAPP_URL,
    ...(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ];
  let hostOk = false;
  try { hostOk = /\.e2b\.app$/.test(new URL(origin).hostname); } catch { /* no origin */ }
  const ok = allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || hostOk;
  return ok && origin
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' }
    : {};
}

const dbConfigured = (env: Env) => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const enc = encodeURIComponent;

// ── Supabase REST (service_role - sirf Worker) ──────────────────────
async function sb(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
}
async function sbJson<T>(env: Env, path: string, init?: RequestInit): Promise<T | null> {
  const r = await sb(env, path, init);
  if (!r.ok) return null;
  const text = await r.text();
  return (text ? JSON.parse(text) : null) as T | null;
}
async function sbList<T>(env: Env, path: string): Promise<T[]> {
  return (await sbJson<T[]>(env, path)) ?? [];
}

/** Write helper: PostgREST error ko saaf English JSON error me badalta hai. */
async function sbWrite(env: Env, path: string, method: string, body?: unknown, prefer?: string): Promise<{ ok: boolean; status: number; rows: Record<string, unknown>[]; detail: string }> {
  const r = await sb(env, path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: prefer ? { Prefer: prefer } : {},
  });
  const text = await r.text();
  let rows: Record<string, unknown>[] = [];
  try { const parsed = text ? JSON.parse(text) : null; if (Array.isArray(parsed)) rows = parsed; else if (parsed && typeof parsed === 'object') rows = [parsed]; } catch { /* ignore */ }
  return { ok: r.ok, status: r.status, rows, detail: text.slice(0, 300) };
}
const dbFail = (detail: string) => err('database_error', `Database request failed. ${detail}`.trim(), 502);

// ── Gothwad Accounts session verify ─────────────────────────────────
interface GothwadUser { id: string; username: string; name: string; email: string; picture?: string }

async function verifyUser(req: Request, env: Env): Promise<GothwadUser | null> {
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  try {
    if (bearer) {
      const r = await fetch(`${env.AUTH_HUB_URL}/oauth/userinfo`, { headers: { Authorization: `Bearer ${bearer}` } });
      if (r.ok) {
        const u = (await r.json()) as Record<string, unknown>;
        return {
          id: String(u.sub ?? ''),
          username: String(u.preferred_username ?? ''),
          name: String(u.name ?? u.preferred_username ?? ''),
          email: String(u.email ?? ''),
          picture: u.picture ? String(u.picture) : undefined,
        };
      }
      return null;
    }
    const cookie = req.headers.get('Cookie');
    if (cookie) {
      const r = await fetch(`${env.AUTH_HUB_URL}/api/auth/me`, { headers: { Cookie: cookie } });
      if (r.ok) {
        const d = (await r.json()) as { user?: Record<string, unknown> };
        if (d.user) {
          return {
            id: String(d.user.id ?? ''),
            username: String(d.user.username ?? ''),
            name: String(d.user.name ?? d.user.username ?? ''),
            email: String(d.user.email ?? ''),
            picture: d.user.picture ? String(d.user.picture) : undefined,
          };
        }
      }
    }
  } catch { /* Accounts down ho to null - caller 401 tay karega */ }
  return null;
}

const isAdmin = (env: Env, u: GothwadUser | null) =>
  !!u && env.ADMIN_USERNAMES.split(',').map((s) => s.trim()).includes(u.username);

// ── DB row → frontend (types.ts) mapping ────────────────────────────
// Android app bhi yahi shapes khata hai - field naam casually mat badlo.
type Row = Record<string, unknown>;
const str = (v: unknown, fallback = '') => (v == null ? fallback : String(v));
const num = (v: unknown, fallback = 0) => (v == null || Number.isNaN(Number(v)) ? fallback : Number(v));
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function mapDeveloper(r: Row) {
  return {
    id: str(r.id), userId: str(r.user_id), username: str(r.username),
    displayName: str(r.display_name), orgName: str(r.org_name), supportEmail: str(r.support_email),
    website: r.website ? str(r.website) : undefined, logoUrl: r.logo_url ? str(r.logo_url) : undefined,
    verified: r.is_verified === true, createdAt: str(r.created_at),
  };
}
function mapApp(r: Row, screenshots: string[] = [], dev?: Row | null) {
  return {
    id: str(r.id), packageName: str(r.package_name), name: str(r.name),
    developerId: str(r.developer_id),
    developerName: dev ? str(dev.org_name) || str(dev.display_name) : '',
    developerVerified: dev ? dev.is_verified === true : undefined,
    category: str(r.category), kind: str(r.kind, 'app'), status: str(r.status, 'draft'),
    shortDesc: str(r.short_desc), fullDesc: str(r.full_desc),
    iconUrl: str(r.icon_url), iconColor: '#2f7d4f',
    featureGraphicUrl: r.feature_graphic_url ? str(r.feature_graphic_url) : undefined,
    screenshots, tags: strArr(r.tags), supportEmail: str(r.support_email),
    website: r.website ? str(r.website) : undefined,
    privacyPolicyUrl: r.privacy_policy_url ? str(r.privacy_policy_url) : undefined,
    ratingAvg: num(r.rating_avg), ratingCount: num(r.rating_count), downloadsCount: num(r.downloads_count),
    featured: r.featured ? (str(r.featured) as 'hero' | 'editors' | 'top_new') : undefined,
    createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  };
}
function mapRelease(r: Row) {
  return {
    id: str(r.id), appId: str(r.app_id), versionCode: num(r.version_code), versionName: str(r.version_name),
    apkProvider: str(r.apk_provider, 'github'), apkKey: str(r.apk_key),
    apkUrl: r.apk_url ? `/api/download/${str(r.id)}` : '',
    apkSizeBytes: num(r.apk_size_bytes), apkSha256: r.apk_sha256 ? str(r.apk_sha256) : undefined,
    minSdk: r.min_sdk == null ? undefined : num(r.min_sdk), targetSdk: r.target_sdk == null ? undefined : num(r.target_sdk),
    permissions: strArr(r.permissions), changelog: str(r.changelog),
    reviewStatus: str(r.review_status, 'pending'), reviewNote: r.review_note ? str(r.review_note) : undefined,
    isLive: r.is_live === true, createdAt: str(r.created_at), downloads: num(r.downloads),
  };
}
function mapReview(r: Row) {
  return {
    id: str(r.id), appId: str(r.app_id), userId: str(r.user_id), username: str(r.username),
    rating: num(r.rating), body: str(r.body),
    developerReply: r.developer_reply ? str(r.developer_reply) : undefined,
    developerReplyAt: r.developer_reply_at ? str(r.developer_reply_at) : undefined,
    createdAt: str(r.created_at),
  };
}
function mapSubmission(r: Row, app?: Row | null, release?: Row | null, dev?: Row | null) {
  return {
    id: str(r.id), appId: str(r.app_id), releaseId: str(r.release_id),
    appName: app ? str(app.name) : '', packageName: app ? str(app.package_name) : '',
    developerName: dev ? str(dev.org_name) || str(dev.display_name) : '',
    versionName: release ? str(release.version_name) : '', versionCode: release ? num(release.version_code) : 0,
    apkProvider: release ? str(release.apk_provider) : '', apkSizeBytes: release ? num(release.apk_size_bytes) : 0,
    status: str(r.status, 'pending'), note: r.note ? str(r.note) : undefined,
    submittedAt: str(r.created_at), decidedAt: r.decided_at ? str(r.decided_at) : undefined,
    decidedBy: r.admin_username ? str(r.admin_username) : undefined,
  };
}
function mapReport(r: Row, app?: Row | null) {
  return {
    id: str(r.id), appId: str(r.app_id), appName: app ? str(app.name) : '',
    reporter: str(r.reporter_username, str(r.reporter_user_id)), reason: str(r.reason),
    details: r.details ? str(r.details) : undefined, status: str(r.status, 'open'), createdAt: str(r.created_at),
  };
}

/** Apps ke saath unke screenshots, live releases, reviews, developer naam bundle karo. */
async function bundleApps(env: Env, appRows: Row[]) {
  if (!appRows.length) return { apps: [], releases: [], reviews: [] };
  const ids = appRows.map((a) => str(a.id));
  const inList = ids.map(enc).join(',');
  const devIds = [...new Set(appRows.map((a) => str(a.developer_id)).filter(Boolean))];
  const [shots, releases, reviews, devs] = await Promise.all([
    sbList<Row>(env, `app_screenshots?app_id=in.(${inList})&select=*&order=sort_order`),
    sbList<Row>(env, `app_releases?app_id=in.(${inList})&is_live=eq.true&select=*&order=version_code.desc`),
    sbList<Row>(env, `reviews?app_id=in.(${inList})&select=*&order=created_at.desc`),
    devIds.length ? sbList<Row>(env, `developers?id=in.(${devIds.map(enc).join(',')})&select=*`) : Promise.resolve([] as Row[]),
  ]);
  const devById = new Map(devs.map((d) => [str(d.id), d]));
  const shotsByApp = new Map<string, string[]>();
  for (const s of shots) {
    const list = shotsByApp.get(str(s.app_id)) ?? [];
    list.push(str(s.url));
    shotsByApp.set(str(s.app_id), list);
  }
  return {
    apps: appRows.map((a) => mapApp(a, shotsByApp.get(str(a.id)) ?? [], devById.get(str(a.developer_id)))),
    releases: releases.map(mapRelease),
    reviews: reviews.map(mapReview),
  };
}

async function findApp(env: Env, idOrPackage: string): Promise<Row | null> {
  const byId = await sbList<Row>(env, `apps?id=eq.${enc(idOrPackage)}&select=*`);
  if (byId.length) return byId[0];
  const byPkg = await sbList<Row>(env, `apps?package_name=eq.${enc(idOrPackage)}&select=*`);
  return byPkg[0] ?? null;
}
async function developerOf(env: Env, user: GothwadUser): Promise<Row | null> {
  const rows = await sbList<Row>(env, `developers?user_id=eq.${enc(user.id)}&select=*`);
  return rows[0] ?? null;
}
async function ownsApp(env: Env, user: GothwadUser, appId: string): Promise<{ app: Row; developer: Row } | { error: Response }> {
  const developer = await developerOf(env, user);
  if (!developer) return { error: err('developer_required', 'Create a developer profile first', 403) };
  const app = await findApp(env, appId);
  if (!app) return { error: err('not_found', 'App not found', 404) };
  if (str(app.developer_id) !== str(developer.id)) return { error: err('forbidden', 'This app does not belong to your developer profile', 403) };
  return { app, developer };
}
async function recomputeRating(env: Env, appId: string): Promise<void> {
  const reviews = await sbList<Row>(env, `reviews?app_id=eq.${enc(appId)}&select=rating`);
  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((t, r) => t + num(r.rating), 0) / count) * 10) / 10 : 0;
  await sbWrite(env, `apps?id=eq.${enc(appId)}`, 'PATCH', { rating_avg: avg, rating_count: count, updated_at: new Date().toISOString() });
}
async function readBody(req: Request): Promise<Row> {
  try { const b = await req.json(); return (b && typeof b === 'object' ? b : {}) as Row; } catch { return {}; }
}

// ── Backblaze B2 (S3 SigV4 presigned PUT) ───────────────────────────
async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
}
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function b2PresignedPut(env: Env, key: string, expiresSec = 3600): Promise<string> {
  const endpoint = env.B2_S3_ENDPOINT.replace(/\/$/, '');
  const host = new URL(endpoint).host;
  const region = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/)?.[1] ?? 'us-west-004';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${env.B2_KEY_ID}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSec),
    'X-Amz-SignedHeaders': 'host',
  });
  const canonical = ['PUT', `/${env.B2_BUCKET}/${encodedKey}`, params.toString(), `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const canonicalHash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)));
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, canonicalHash].join('\n');
  let k: ArrayBuffer | Uint8Array = new TextEncoder().encode('AWS4' + env.B2_APP_KEY);
  k = await hmac(k, date); k = await hmac(k, region); k = await hmac(k, 's3'); k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, stringToSign));
  return `${endpoint}/${env.B2_BUCKET}/${encodedKey}?${params}&X-Amz-Signature=${signature}`;
}

// ── GitHub store-files upload (APK <=25MB - Worker khud karega) ─────
async function githubUploadApk(env: Env, packageName: string, versionCode: number, fileName: string, bytes: ArrayBuffer): Promise<string> {
  const base = `https://api.github.com/repos/${env.GITHUB_FILES_OWNER}/${env.GITHUB_FILES_REPO}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_FILES_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gothwad-store-worker',
  };
  const tag = `${packageName}@${versionCode}`;
  let rel = await fetch(`${base}/releases/tags/${encodeURIComponent(tag)}`, { headers });
  if (rel.status === 404) {
    rel = await fetch(`${base}/releases`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tag, name: `${packageName} v${versionCode}`, body: 'Uploaded by Gothwad Store' }),
    });
  }
  if (!rel.ok) throw new Error('GitHub release creation failed');
  const release = (await rel.json()) as { upload_url: string };
  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const up = await fetch(uploadUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/vnd.android.package-archive' }, body: bytes });
  if (!up.ok) throw new Error('GitHub asset upload failed');
  const asset = (await up.json()) as { browser_download_url: string };
  return asset.browser_download_url;
}

// ═══════════════════ ROUTES ════════════════════════════════════════
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
    }
    const out = (r: Response) => { Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v)); return r; };
    try {
      // Health
      if (path === '/api/health') {
        return out(json({
          service: 'store', ok: true,
          configured: {
            supabase: dbConfigured(env),
            imgbb: !!env.IMGBB_API_KEY,
            githubFiles: !!env.GITHUB_FILES_TOKEN,
            backblazeB2: !!(env.B2_KEY_ID && env.B2_BUCKET),
            accounts: env.AUTH_HUB_URL,
          },
        }));
      }

      // ── Auth ──────────────────────────────────────────────
      if (path === '/api/me') {
        const user = await verifyUser(req, env);
        if (!user) return out(err('unauthorized', 'Please sign in with Gothwad', 401));
        let developer: unknown = null;
        if (dbConfigured(env)) {
          const dev = await developerOf(env, user);
          developer = dev ? mapDeveloper(dev) : null;
        }
        return out(json({ user, developer, isAdmin: isAdmin(env, user), configured: { supabase: dbConfigured(env) } }));
      }

      if (path === '/api/auth/exchange' && req.method === 'POST') {
        const body = (await req.json()) as { code: string; redirectUri: string; codeVerifier: string };
        const tokenRes = await fetch(`${env.AUTH_HUB_URL}/oauth/token`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code', code: body.code,
            redirect_uri: body.redirectUri, client_id: env.OAUTH_CLIENT_ID,
            code_verifier: body.codeVerifier,
          }),
        });
        if (!tokenRes.ok) return out(err('exchange_failed', 'Authorization code exchange failed', 401));
        const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
        const user = await verifyUser(new Request(req.url, { headers: { Authorization: `Bearer ${tokens.access_token}` } }), env);
        return out(json({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user }));
      }

      if (path === '/api/auth/signout' && req.method === 'POST') return out(json({ ok: true }));

      // ── Public Store API ──────────────────────────────────
      if (path === '/api/store/categories') {
        if (!dbConfigured(env)) return out(json({ categories: [], source: 'unconfigured' }));
        const rows = await sbList<Row>(env, 'categories?select=*&order=name');
        return out(json({ categories: rows.map((c) => ({ slug: str(c.slug), name: str(c.name), kind: str(c.kind, 'both'), icon: str(c.icon, 'LayoutGrid') })) }));
      }

      if (path === '/api/store/home' || path === '/api/store/apps' || path === '/api/store/search' || path === '/api/store/charts') {
        if (!dbConfigured(env)) return out(json({ apps: [], releases: [], reviews: [], source: 'unconfigured', message: 'Supabase is not configured; the frontend is showing demo data' }));
        const kind = url.searchParams.get('kind');
        const category = url.searchParams.get('category');
        const q = (url.searchParams.get('q') ?? '').replace(/[%*]/g, '').trim();
        let query = 'apps?status=eq.published&select=*&order=downloads_count.desc&limit=100';
        if (kind) query += `&kind=eq.${enc(kind)}`;
        if (category) query += `&category=eq.${enc(category)}`;
        if (q) query += `&name=ilike.*${enc(q)}*`;
        const rows = await sbList<Row>(env, query);
        const bundle = await bundleApps(env, rows);
        return out(json({ ...bundle, source: 'live' }));
      }

      // ── Login wale store actions (reviews / wishlist / report / library) ──
      const storeAction = path.match(/^\/api\/store\/apps\/([^/]+)\/(reviews|wishlist|report|library)$/);
      if (storeAction && req.method !== 'GET') {
        const user = await verifyUser(req, env);
        if (!user) return out(err('unauthorized', 'Please sign in with Gothwad', 401));
        if (!dbConfigured(env)) return out(err('supabase_not_configured', 'The Store Supabase project is not configured yet (SUPABASE_URL / SERVICE_ROLE_KEY)', 503));
        const app = await findApp(env, decodeURIComponent(storeAction[1]));
        if (!app) return out(err('not_found', 'App not found', 404));
        const appId = str(app.id);
        const action = storeAction[2];

        if (action === 'reviews' && req.method === 'POST') {
          const body = await readBody(req);
          const rating = num(body.rating);
          if (!Number.isInteger(rating) || rating < 1 || rating > 5) return out(err('bad_request', 'Rating must be a whole number between 1 and 5', 400));
          // Ek user = ek review per app (DB unique bhi yahi kehta hai): dobara bhejne par update.
          const existing = await sbList<Row>(env, `reviews?app_id=eq.${enc(appId)}&user_id=eq.${enc(user.id)}&select=*`);
          let saved: Row | null = null;
          if (existing.length) {
            const w = await sbWrite(env, `reviews?id=eq.${enc(str(existing[0].id))}`, 'PATCH', { rating, body: str(body.body) });
            if (!w.ok) return out(dbFail(w.detail));
            saved = w.rows[0] ?? null;
          } else {
            const w = await sbWrite(env, 'reviews', 'POST', { id: newId('rev'), app_id: appId, user_id: user.id, username: user.username, rating, body: str(body.body) });
            if (!w.ok) return out(dbFail(w.detail));
            saved = w.rows[0] ?? null;
          }
          await recomputeRating(env, appId);
          return out(json({ review: saved ? mapReview(saved) : null }));
        }
        if (action === 'reviews' && req.method === 'DELETE') {
          const w = await sbWrite(env, `reviews?app_id=eq.${enc(appId)}&user_id=eq.${enc(user.id)}`, 'DELETE');
          if (!w.ok) return out(dbFail(w.detail));
          await recomputeRating(env, appId);
          return out(json({ ok: true }));
        }
        if (action === 'wishlist' && req.method === 'POST') {
          const w = await sbWrite(env, 'wishlists', 'POST', { user_id: user.id, app_id: appId }, 'resolution=ignore-duplicates,return=minimal');
          if (!w.ok) return out(dbFail(w.detail));
          return out(json({ ok: true, wishlisted: true }));
        }
        if (action === 'wishlist' && req.method === 'DELETE') {
          const w = await sbWrite(env, `wishlists?user_id=eq.${enc(user.id)}&app_id=eq.${enc(appId)}`, 'DELETE');
          if (!w.ok) return out(dbFail(w.detail));
          return out(json({ ok: true, wishlisted: false }));
        }
        if (action === 'report' && req.method === 'POST') {
          const body = await readBody(req);
          const w = await sbWrite(env, 'reports', 'POST', {
            id: newId('rep'), app_id: appId, reporter_user_id: user.id, reporter_username: user.username,
            reason: str(body.reason, 'Other'), details: str(body.details) || null, status: 'open',
          });
          if (!w.ok) {
            // reporter_username column agar purani SQL me na ho to uske bina dobara koshish
            const retry = await sbWrite(env, 'reports', 'POST', { id: newId('rep'), app_id: appId, reporter_user_id: user.id, reason: str(body.reason, 'Other'), details: str(body.details) || null, status: 'open' });
            if (!retry.ok) return out(dbFail(retry.detail));
            return out(json({ report: retry.rows[0] ? mapReport(retry.rows[0], app) : null }));
          }
          return out(json({ report: w.rows[0] ? mapReport(w.rows[0], app) : null }));
        }
        if (action === 'library' && req.method === 'POST') {
          const body = await readBody(req);
          const w = await sbWrite(env, 'library', 'POST',
            { user_id: user.id, app_id: appId, last_version_code: body.versionCode == null ? null : num(body.versionCode) },
            'resolution=merge-duplicates,return=minimal');
          if (!w.ok) return out(dbFail(w.detail));
          return out(json({ ok: true }));
        }
        return out(err('method_not_allowed', 'Method not allowed', 405));
      }

      if (path === '/api/store/library' || path === '/api/store/wishlist') {
        const user = await verifyUser(req, env);
        if (!user) return out(err('unauthorized', 'Please sign in with Gothwad', 401));
        if (!dbConfigured(env)) return out(err('supabase_not_configured', 'The Store Supabase project is not configured yet (SUPABASE_URL / SERVICE_ROLE_KEY)', 503));
        const table = path.endsWith('library') ? 'library' : 'wishlists';
        const rows = await sbList<Row>(env, `${table}?user_id=eq.${enc(user.id)}&select=app_id`);
        return out(json({ appIds: rows.map((r) => str(r.app_id)) }));
      }

      const appMatch = path.match(/^\/api\/store\/apps\/(.+)$/);
      if (appMatch && req.method === 'GET') {
        if (!dbConfigured(env)) return out(err('unconfigured', 'Supabase is not configured', 503));
        const app = await findApp(env, decodeURIComponent(appMatch[1]));
        if (!app || str(app.status) !== 'published') return out(err('not_found', 'App not found', 404));
        const bundle = await bundleApps(env, [app]);
        const live = bundle.releases[0] ?? null;
        return out(json({ app: bundle.apps[0], screenshots: bundle.apps[0]?.screenshots ?? [], liveRelease: live, releases: bundle.releases, reviews: bundle.reviews }));
      }

      // Download: pehle count (IP+app+day dedupe), phir asal file (GitHub/B2) par redirect
      const dlMatch = path.match(/^\/api\/download\/(.+)$/);
      if (dlMatch) {
        if (!dbConfigured(env)) return out(err('unconfigured', 'Supabase is not configured; demo downloads are unavailable', 503));
        const rels = await sbList<Row>(env, `app_releases?id=eq.${enc(dlMatch[1])}&select=*`);
        if (!rels.length) return out(err('not_found', 'Release not found', 404));
        const rel = rels[0];
        if (!str(rel.apk_url)) return out(err('not_found', 'Release file not found', 404));
        const user = await verifyUser(req, env);
        const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
        const day = new Date().toISOString().slice(0, 10);
        const ipHash = await sha256Hex(new TextEncoder().encode(`${ip}|${str(rel.app_id)}|${day}`));
        const already = await sbList<Row>(env, `downloads?ip_hash=eq.${ipHash}&select=id&limit=1`);
        if (!already.length) {
          await sbWrite(env, 'downloads', 'POST', { app_id: str(rel.app_id), release_id: str(rel.id), user_id: user?.id ?? null, ip_hash: ipHash, user_agent: req.headers.get('User-Agent') ?? null }, 'return=minimal');
          const appRows = await sbList<Row>(env, `apps?id=eq.${enc(str(rel.app_id))}&select=downloads_count`);
          if (appRows.length) await sbWrite(env, `apps?id=eq.${enc(str(rel.app_id))}`, 'PATCH', { downloads_count: num(appRows[0].downloads_count) + 1 }, 'return=minimal');
          await sbWrite(env, `app_releases?id=eq.${enc(str(rel.id))}`, 'PATCH', { downloads: num(rel.downloads) + 1 }, 'return=minimal');
        }
        if (user) {
          await sbWrite(env, 'library', 'POST', { user_id: user.id, app_id: str(rel.app_id), last_version_code: num(rel.version_code) }, 'resolution=merge-duplicates,return=minimal');
        }
        return out(new Response(null, { status: 302, headers: { Location: str(rel.apk_url) } }));
      }

      // ── Uploads (login zaroori; DB zaroori NAHI - files DB me nahi jate) ──
      if (path.startsWith('/api/uploads')) {
        const user = await verifyUser(req, env);
        if (!user) return out(err('unauthorized', 'Please sign in with Gothwad', 401));

        if (path === '/api/uploads/image' && req.method === 'POST') {
          // Saari images ImgBB par. Browser pehle hi resize/compress karke bhejta hai.
          if (!env.IMGBB_API_KEY) return out(err('imgbb_not_configured', 'IMGBB_API_KEY is not configured', 503));
          const form = await req.formData();
          const image = form.get('image');
          if (!image) return out(err('bad_request', 'An image file is required', 400));
          const up = new FormData();
          up.append('image', image);
          type ImgbbResponse = { data?: { url: string; delete_url: string }; success?: boolean };
          let d: ImgbbResponse | null = null;
          try {
            const r = await fetch(`https://api.imgbb.com/1/upload?key=${env.IMGBB_API_KEY}`, { method: 'POST', body: up });
            d = (await r.json().catch(() => null)) as ImgbbResponse | null;
          } catch { d = null; }
          if (!d?.success || !d.data) return out(err('imgbb_failed', 'ImgBB upload failed. Please try again.', 502));
          return out(json({ provider: 'imgbb', url: d.data.url, deleteUrl: d.data.delete_url }));
        }

        if (path === '/api/uploads/apk-inspect' && req.method === 'POST') {
          // APK bane bina store kiye manifest auto-read (console form auto-fill ke liye).
          const form = await req.formData();
          const file = form.get('file') as File | null;
          if (!file) return out(err('bad_request', 'An APK file is required', 400));
          const bytes = await file.arrayBuffer();
          const [manifest, sha256] = await Promise.all([parseApkManifest(bytes), sha256Hex(bytes)]);
          return out(json({ manifest, sizeBytes: file.size, sha256 }));
        }

        if (path === '/api/uploads/apk-ticket' && req.method === 'POST') {
          // Rule: <=25MB GitHub (Worker upload karega) - >25MB B2 (browser direct presigned)
          const body = (await req.json()) as { packageName: string; versionCode: number; fileName: string; sizeBytes: number; contentType?: string };
          if (!body?.sizeBytes) return out(err('bad_request', 'sizeBytes is required', 400));
          if (body.sizeBytes <= APK_GITHUB_LIMIT) {
            return out(json({ provider: 'github', mode: 'worker-upload', uploadUrl: '/api/uploads/apk' }));
          }
          if (!env.B2_KEY_ID || !env.B2_BUCKET || !env.B2_S3_ENDPOINT) return out(err('b2_not_configured', 'Backblaze B2 is not configured', 503));
          const key = `${body.packageName}/${body.versionCode}/${body.fileName}`;
          const uploadUrl = await b2PresignedPut(env, key);
          const publicUrl = env.B2_PUBLIC_BASE ? `${env.B2_PUBLIC_BASE.replace(/\/$/, '')}/${key}` : uploadUrl.split('?')[0];
          return out(json({ provider: 'b2', mode: 'presigned-put', uploadUrl, publicUrl, key }));
        }

        if (path === '/api/uploads/apk' && req.method === 'POST') {
          // GitHub wala raasta: chhoti APK Worker ke through store-files Releases me
          if (!env.GITHUB_FILES_TOKEN) return out(err('github_not_configured', 'GITHUB_FILES_TOKEN is not configured', 503));
          const form = await req.formData();
          const file = form.get('file') as File | null;
          const packageName = String(form.get('packageName') ?? '');
          const versionCode = Number(form.get('versionCode') ?? 0);
          if (!file || !packageName || !versionCode) return out(err('bad_request', 'file, packageName, and versionCode are required', 400));
          if (file.size > APK_GITHUB_LIMIT) return out(err('too_large_for_github', 'APKs over 25 MB go to Backblaze B2; request /api/uploads/apk-ticket first', 413));
          const bytes = await file.arrayBuffer();
          const [manifest, sha256] = await Promise.all([parseApkManifest(bytes), sha256Hex(bytes)]);
          if (manifest.packageName && manifest.packageName !== packageName) {
            return out(err('package_mismatch', `The APK package (${manifest.packageName}) does not match this listing (${packageName})`, 400));
          }
          const downloadUrl = await githubUploadApk(env, packageName, versionCode, file.name, bytes);
          return out(json({ provider: 'github', url: downloadUrl, key: `${packageName}@${versionCode}/${file.name}`, manifest, sha256, sizeBytes: file.size }));
        }
        return out(err('not_found', 'Upload route not found', 404));
      }

      // ── Developer + Admin CRUD (login + DB dono zaroori) ──
      if (path.startsWith('/api/dev') || path.startsWith('/api/admin')) {
        const user = await verifyUser(req, env);
        if (!user) return out(err('unauthorized', 'Please sign in with Gothwad', 401));
        if (!dbConfigured(env)) return out(err('supabase_not_configured', 'The Store Supabase project is not configured yet (SUPABASE_URL / SERVICE_ROLE_KEY)', 503));
        if (path.startsWith('/api/admin') && !isAdmin(env, user)) return out(err('forbidden', 'Admin access required', 403));

        // ───────── Developer ─────────
        if (path === '/api/dev/register' && req.method === 'POST') {
          const body = await readBody(req);
          if (!str(body.displayName).trim() || !str(body.supportEmail).trim()) return out(err('bad_request', 'Display name and support email are required', 400));
          const existing = await developerOf(env, user);
          const payload = {
            display_name: str(body.displayName), org_name: str(body.orgName), support_email: str(body.supportEmail),
            website: str(body.website) || null, logo_url: str(body.logoUrl) || null,
          };
          if (existing) {
            const w = await sbWrite(env, `developers?id=eq.${enc(str(existing.id))}`, 'PATCH', payload);
            if (!w.ok) return out(dbFail(w.detail));
            return out(json({ developer: mapDeveloper(w.rows[0] ?? { ...existing, ...payload }) }));
          }
          const id = `dev-${user.username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'developer'}`;
          const w = await sbWrite(env, 'developers', 'POST', { id, user_id: user.id, username: user.username, ...payload });
          if (!w.ok) return out(dbFail(w.detail));
          return out(json({ developer: mapDeveloper(w.rows[0]) }));
        }

        if (path === '/api/dev/apps' && req.method === 'GET') {
          const developer = await developerOf(env, user);
          if (!developer) return out(err('developer_required', 'Create a developer profile first', 403));
          const appRows = await sbList<Row>(env, `apps?developer_id=eq.${enc(str(developer.id))}&select=*&order=updated_at.desc`);
          const bundle = await bundleApps(env, appRows);
          const appIds = appRows.map((a) => str(a.id));
          let releases: Row[] = []; let submissions: Row[] = [];
          if (appIds.length) {
            const inList = appIds.map(enc).join(',');
            [releases, submissions] = await Promise.all([
              sbList<Row>(env, `app_releases?app_id=in.(${inList})&select=*&order=version_code.desc`),
              sbList<Row>(env, `review_submissions?app_id=in.(${inList})&select=*&order=created_at.desc`),
            ]);
          }
          const appById = new Map(appRows.map((a) => [str(a.id), a]));
          const relById = new Map(releases.map((r) => [str(r.id), r]));
          return out(json({
            developer: mapDeveloper(developer),
            apps: bundle.apps, releases: releases.map(mapRelease), reviews: bundle.reviews,
            submissions: submissions.map((s) => mapSubmission(s, appById.get(str(s.app_id)), relById.get(str(s.release_id)), developer)),
          }));
        }

        if (path === '/api/dev/apps' && req.method === 'POST') {
          const developer = await developerOf(env, user);
          if (!developer) return out(err('developer_required', 'Create a developer profile first', 403));
          const body = await readBody(req);
          const name = str(body.name).trim();
          const packageName = str(body.packageName).trim().toLowerCase();
          if (!name || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
            return out(err('bad_request', 'A name and a valid package name (e.g. com.company.app) are required', 400));
          }
          const taken = await sbList<Row>(env, `apps?package_name=eq.${enc(packageName)}&select=id`);
          if (taken.length) return out(err('package_taken', 'This package name is already taken', 409));
          const w = await sbWrite(env, 'apps', 'POST', {
            id: newId('app'), developer_id: str(developer.id), package_name: packageName, name,
            category: str(body.category, 'tools'), kind: str(body.kind, 'app') === 'game' ? 'game' : 'app',
            status: 'draft', support_email: str(developer.support_email),
          });
          if (!w.ok) return out(w.status === 409 ? err('package_taken', 'This package name is already taken', 409) : dbFail(w.detail));
          const bundle = await bundleApps(env, w.rows);
          return out(json({ app: bundle.apps[0] }, 201));
        }

        const devReviewReply = path.match(/^\/api\/dev\/apps\/([^/]+)\/reviews\/([^/]+)\/reply$/);
        if (devReviewReply && req.method === 'POST') {
          const owned = await ownsApp(env, user, decodeURIComponent(devReviewReply[1]));
          if ('error' in owned) return out(owned.error);
          const body = await readBody(req);
          if (!str(body.reply).trim()) return out(err('bad_request', 'Reply text is required', 400));
          const reviewRows = await sbList<Row>(env, `reviews?id=eq.${enc(devReviewReply[2])}&app_id=eq.${enc(str(owned.app.id))}&select=*`);
          if (!reviewRows.length) return out(err('not_found', 'Review not found', 404));
          const w = await sbWrite(env, `reviews?id=eq.${enc(devReviewReply[2])}`, 'PATCH', { developer_reply: str(body.reply), developer_reply_at: new Date().toISOString() });
          if (!w.ok) return out(dbFail(w.detail));
          return out(json({ review: w.rows[0] ? mapReview(w.rows[0]) : null }));
        }

        const devSubmit = path.match(/^\/api\/dev\/apps\/([^/]+)\/releases\/([^/]+)\/submit$/);
        if (devSubmit && req.method === 'POST') {
          const owned = await ownsApp(env, user, decodeURIComponent(devSubmit[1]));
          if ('error' in owned) return out(owned.error);
          const appId = str(owned.app.id);
          const relRows = await sbList<Row>(env, `app_releases?id=eq.${enc(devSubmit[2])}&app_id=eq.${enc(appId)}&select=*`);
          if (!relRows.length) return out(err('not_found', 'Release not found', 404));
          const rel = relRows[0];
          if (!str(rel.apk_url)) return out(err('bad_request', 'Upload the APK file before submitting for review', 400));
          const pending = await sbList<Row>(env, `review_submissions?release_id=eq.${enc(str(rel.id))}&status=eq.pending&select=*`);
          let submission = pending[0] ?? null;
          if (!submission) {
            if (str(rel.review_status) === 'rejected') await sbWrite(env, `app_releases?id=eq.${enc(str(rel.id))}`, 'PATCH', { review_status: 'pending', review_note: null }, 'return=minimal');
            const w = await sbWrite(env, 'review_submissions', 'POST', { id: newId('sub'), app_id: appId, release_id: str(rel.id), submitted_by: user.username, status: 'pending' });
            if (!w.ok) return out(dbFail(w.detail));
            submission = w.rows[0] ?? null;
          }
          // Published app ka purana live version chalta rahega; sirf unpublished app in_review me jayega.
          if (str(owned.app.status) !== 'published') {
            await sbWrite(env, `apps?id=eq.${enc(appId)}`, 'PATCH', { status: 'in_review', updated_at: new Date().toISOString() }, 'return=minimal');
          }
          const dev = await developerOf(env, user);
          return out(json({ submission: submission ? mapSubmission(submission, owned.app, rel, dev) : null }));
        }

        const devAppAction = path.match(/^\/api\/dev\/apps\/([^/]+)\/(releases|reviews|stats)$/);
        if (devAppAction) {
          const owned = await ownsApp(env, user, decodeURIComponent(devAppAction[1]));
          if ('error' in owned) return out(owned.error);
          const appId = str(owned.app.id);
          const section = devAppAction[2];

          if (section === 'releases' && req.method === 'GET') {
            const rows = await sbList<Row>(env, `app_releases?app_id=eq.${enc(appId)}&select=*&order=version_code.desc`);
            return out(json({ releases: rows.map(mapRelease) }));
          }
          if (section === 'releases' && req.method === 'POST') {
            const body = await readBody(req);
            const versionCode = num(body.versionCode);
            const versionName = str(body.versionName).trim();
            const apk = (body.apk && typeof body.apk === 'object' ? body.apk : {}) as Row;
            const manifest = (body.manifest && typeof body.manifest === 'object' ? body.manifest : {}) as Row;
            if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) return out(err('bad_request', 'versionName and a positive integer versionCode are required', 400));
            if (!str(apk.url)) return out(err('bad_request', 'Upload the APK first, then create the release with the returned URL', 400));
            const manifestPackage = manifest.packageName ? str(manifest.packageName) : null;
            if (manifestPackage && manifestPackage !== str(owned.app.package_name)) {
              return out(err('package_mismatch', `The APK package (${manifestPackage}) does not match this listing (${str(owned.app.package_name)})`, 400));
            }
            const existing = await sbList<Row>(env, `app_releases?app_id=eq.${enc(appId)}&select=version_code&order=version_code.desc&limit=1`);
            const maxCode = existing.length ? num(existing[0].version_code) : 0;
            if (versionCode <= maxCode) return out(err('version_code_not_increasing', `Version code must be higher than the current highest version code (${maxCode})`, 400));
            const sizeBytes = num(apk.sizeBytes ?? body.sizeBytes);
            const provider = str(apk.provider, sizeBytes <= APK_GITHUB_LIMIT ? 'github' : 'b2');
            if (provider !== 'github' && provider !== 'b2') return out(err('bad_request', 'APK provider must be github or b2', 400));
            const w = await sbWrite(env, 'app_releases', 'POST', {
              id: newId('rel'), app_id: appId, version_code: versionCode, version_name: versionName,
              apk_provider: provider, apk_key: str(apk.key), apk_url: str(apk.url), apk_size_bytes: sizeBytes,
              apk_sha256: str(apk.sha256) || null,
              min_sdk: manifest.minSdk == null ? null : num(manifest.minSdk), target_sdk: manifest.targetSdk == null ? null : num(manifest.targetSdk),
              permissions: Array.isArray(manifest.permissions) ? manifest.permissions.map(String) : strArr(body.permissions),
              changelog: str(body.changelog), review_status: 'pending', is_live: false,
            });
            if (!w.ok) return out(dbFail(w.detail));
            return out(json({ release: mapRelease(w.rows[0]) }, 201));
          }
          if (section === 'reviews' && req.method === 'GET') {
            const rows = await sbList<Row>(env, `reviews?app_id=eq.${enc(appId)}&select=*&order=created_at.desc`);
            return out(json({ reviews: rows.map(mapReview) }));
          }
          if (section === 'stats' && req.method === 'GET') {
            const days = Math.min(90, Math.max(1, num(url.searchParams.get('days'), 7)));
            const since = new Date(Date.now() - (days - 1) * 86400000);
            since.setUTCHours(0, 0, 0, 0);
            const rows = await sbList<Row>(env, `downloads?app_id=eq.${enc(appId)}&created_at=gte.${enc(since.toISOString())}&select=created_at`);
            const perDay = new Map<string, number>();
            for (let i = 0; i < days; i++) perDay.set(new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10), 0);
            for (const r of rows) { const d = str(r.created_at).slice(0, 10); if (perDay.has(d)) perDay.set(d, (perDay.get(d) ?? 0) + 1); }
            return out(json({
              days: [...perDay.entries()].map(([date, count]) => ({ date, count })),
              totalDownloads: num(owned.app.downloads_count), ratingAvg: num(owned.app.rating_avg), ratingCount: num(owned.app.rating_count),
            }));
          }
          return out(err('method_not_allowed', 'Method not allowed', 405));
        }

        const devApp = path.match(/^\/api\/dev\/apps\/([^/]+)$/);
        if (devApp) {
          const owned = await ownsApp(env, user, decodeURIComponent(devApp[1]));
          if ('error' in owned) return out(owned.error);
          const appId = str(owned.app.id);
          if (req.method === 'GET') {
            const bundle = await bundleApps(env, [owned.app]);
            const rows = await sbList<Row>(env, `app_releases?app_id=eq.${enc(appId)}&select=*&order=version_code.desc`);
            return out(json({ app: bundle.apps[0], releases: rows.map(mapRelease), reviews: bundle.reviews }));
          }
          if (req.method === 'PATCH') {
            const body = await readBody(req);
            const patchRow: Row = { updated_at: new Date().toISOString() };
            const fields: Record<string, string> = {
              name: 'name', category: 'category', shortDesc: 'short_desc', fullDesc: 'full_desc',
              iconUrl: 'icon_url', featureGraphicUrl: 'feature_graphic_url', supportEmail: 'support_email',
              website: 'website', privacyPolicyUrl: 'privacy_policy_url',
            };
            for (const [from, to] of Object.entries(fields)) if (from in body) patchRow[to] = str(body[from]) || null;
            if ('kind' in body) patchRow.kind = str(body.kind) === 'game' ? 'game' : 'app';
            if ('tags' in body) patchRow.tags = strArr(body.tags);
            // Status sirf delist/relist yahan se: publish hamesha review ke baad hi (Worker rule).
            if ('status' in body) {
              const wanted = str(body.status);
              if (wanted === 'unlisted') patchRow.status = 'unlisted';
              else if (wanted === 'published') {
                const live = await sbList<Row>(env, `app_releases?app_id=eq.${enc(appId)}&is_live=eq.true&select=id&limit=1`);
                if (!live.length) return out(err('no_live_release', 'An approved release is required before this app can go live', 400));
                patchRow.status = 'published';
              } else return out(err('bad_request', 'Only unlisted or published (with a live release) can be set here', 400));
            }
            const w = await sbWrite(env, `apps?id=eq.${enc(appId)}`, 'PATCH', patchRow);
            if (!w.ok) return out(dbFail(w.detail));
            if (Array.isArray(body.screenshots)) {
              await sbWrite(env, `app_screenshots?app_id=eq.${enc(appId)}`, 'DELETE', undefined, 'return=minimal');
              const shots = body.screenshots.map(String).filter(Boolean).slice(0, 8);
              if (shots.length) {
                await sbWrite(env, 'app_screenshots', 'POST', shots.map((shotUrl, i) => ({ id: newId('shot'), app_id: appId, url: shotUrl, provider: 'imgbb', sort_order: i, type: 'phone' })), 'return=minimal');
              }
            }
            const bundle = await bundleApps(env, w.rows.length ? w.rows : [owned.app]);
            return out(json({ app: bundle.apps[0] }));
          }
          return out(err('method_not_allowed', 'Method not allowed', 405));
        }

        const devStatus = path.match(/^\/api\/dev\/apps\/([^/]+)\/(delist|relist)$/);
        if (devStatus && req.method === 'POST') {
          const owned = await ownsApp(env, user, decodeURIComponent(devStatus[1]));
          if ('error' in owned) return out(owned.error);
          const appId = str(owned.app.id);
          if (devStatus[2] === 'relist') {
            const live = await sbList<Row>(env, `app_releases?app_id=eq.${enc(appId)}&is_live=eq.true&select=id&limit=1`);
            if (!live.length) return out(err('no_live_release', 'An approved release is required before this app can go live', 400));
          }
          const w = await sbWrite(env, `apps?id=eq.${enc(appId)}`, 'PATCH', { status: devStatus[2] === 'delist' ? 'unlisted' : 'published', updated_at: new Date().toISOString() });
          if (!w.ok) return out(dbFail(w.detail));
          const bundle = await bundleApps(env, w.rows);
          return out(json({ app: bundle.apps[0] }));
        }

        if (path === '/api/dev/reviews' && req.method === 'GET') {
          const developer = await developerOf(env, user);
          if (!developer) return out(err('developer_required', 'Create a developer profile first', 403));
          const appRows = await sbList<Row>(env, `apps?developer_id=eq.${enc(str(developer.id))}&select=id`);
          if (!appRows.length) return out(json({ reviews: [] }));
          const rows = await sbList<Row>(env, `reviews?app_id=in.(${appRows.map((a) => enc(str(a.id))).join(',')})&select=*&order=created_at.desc`);
          return out(json({ reviews: rows.map(mapReview) }));
        }

        // ───────── Admin ─────────
        if (path === '/api/admin/queue' && req.method === 'GET') {
          const subs = await sbList<Row>(env, 'review_submissions?status=eq.pending&select=*&order=created_at.asc');
          const appIds = [...new Set(subs.map((s) => str(s.app_id)))];
          const relIds = [...new Set(subs.map((s) => str(s.release_id)))];
          const [appRows, relRows] = await Promise.all([
            appIds.length ? sbList<Row>(env, `apps?id=in.(${appIds.map(enc).join(',')})&select=*`) : Promise.resolve([] as Row[]),
            relIds.length ? sbList<Row>(env, `app_releases?id=in.(${relIds.map(enc).join(',')})&select=*`) : Promise.resolve([] as Row[]),
          ]);
          const bundle = await bundleApps(env, appRows);
          const relById = new Map(relRows.map((r) => [str(r.id), r]));
          const appRawById = new Map(appRows.map((a) => [str(a.id), a]));
          const devIds = [...new Set(appRows.map((a) => str(a.developer_id)))];
          const devs = devIds.length ? await sbList<Row>(env, `developers?id=in.(${devIds.map(enc).join(',')})&select=*`) : [];
          const devById = new Map(devs.map((d) => [str(d.id), d]));
          return out(json({
            submissions: subs.map((s) => mapSubmission(s, appRawById.get(str(s.app_id)), relById.get(str(s.release_id)), devById.get(str(appRawById.get(str(s.app_id))?.developer_id)))),
            apps: bundle.apps, releases: relRows.map(mapRelease),
          }));
        }

        if (path === '/api/admin/apps' && req.method === 'GET') {
          const rows = await sbList<Row>(env, 'apps?select=*&order=updated_at.desc&limit=200');
          const bundle = await bundleApps(env, rows);
          const subs = await sbList<Row>(env, 'review_submissions?select=*&order=created_at.desc&limit=50');
          const relIds = [...new Set(subs.map((s) => str(s.release_id)))];
          const relRows = relIds.length ? await sbList<Row>(env, `app_releases?id=in.(${relIds.map(enc).join(',')})&select=*`) : [];
          const relById = new Map(relRows.map((r) => [str(r.id), r]));
          const appById = new Map(rows.map((a) => [str(a.id), a]));
          const devIds = [...new Set(rows.map((a) => str(a.developer_id)))];
          const devs = devIds.length ? await sbList<Row>(env, `developers?id=in.(${devIds.map(enc).join(',')})&select=*`) : [];
          const devById = new Map(devs.map((d) => [str(d.id), d]));
          return out(json({
            apps: bundle.apps, releases: bundle.releases,
            submissions: subs.map((s) => mapSubmission(s, appById.get(str(s.app_id)), relById.get(str(s.release_id)), devById.get(str(appById.get(str(s.app_id))?.developer_id)))),
          }));
        }

        if (path === '/api/admin/reports' && req.method === 'GET') {
          const rows = await sbList<Row>(env, 'reports?select=*&order=created_at.desc&limit=100');
          const appIds = [...new Set(rows.map((r) => str(r.app_id)))];
          const appRows = appIds.length ? await sbList<Row>(env, `apps?id=in.(${appIds.map(enc).join(',')})&select=*`) : [];
          const appById = new Map(appRows.map((a) => [str(a.id), a]));
          return out(json({ reports: rows.map((r) => mapReport(r, appById.get(str(r.app_id)))) }));
        }

        const adminDecide = path.match(/^\/api\/admin\/submissions\/([^/]+)\/(approve|reject)$/);
        if (adminDecide && req.method === 'POST') {
          const body = await readBody(req);
          const note = str(body.note).trim();
          if (adminDecide[2] === 'reject' && !note) return out(err('note_required', 'A reviewer note is required to reject a submission', 400));
          const subs = await sbList<Row>(env, `review_submissions?id=eq.${enc(adminDecide[1])}&select=*`);
          if (!subs.length) return out(err('not_found', 'Submission not found', 404));
          const sub = subs[0];
          if (str(sub.status) !== 'pending') return out(err('already_decided', 'This submission has already been decided', 409));
          const appId = str(sub.app_id); const releaseId = str(sub.release_id);
          const nowIso = new Date().toISOString();
          const approve = adminDecide[2] === 'approve';
          const relWrite = approve
            ? await sbWrite(env, `app_releases?id=eq.${enc(releaseId)}`, 'PATCH', { review_status: 'approved', review_note: note || null, is_live: true })
            : await sbWrite(env, `app_releases?id=eq.${enc(releaseId)}`, 'PATCH', { review_status: 'rejected', review_note: note, is_live: false });
          if (!relWrite.ok) return out(dbFail(relWrite.detail));
          if (approve) {
            // Ek samay par ek hi live release: baaki sab non-live.
            await sbWrite(env, `app_releases?app_id=eq.${enc(appId)}&id=neq.${enc(releaseId)}&is_live=eq.true`, 'PATCH', { is_live: false }, 'return=minimal');
            await sbWrite(env, `apps?id=eq.${enc(appId)}`, 'PATCH', { status: 'published', updated_at: nowIso }, 'return=minimal');
          } else {
            const live = await sbList<Row>(env, `app_releases?app_id=eq.${enc(appId)}&is_live=eq.true&select=id&limit=1`);
            await sbWrite(env, `apps?id=eq.${enc(appId)}`, 'PATCH', { status: live.length ? 'published' : 'draft', updated_at: nowIso }, 'return=minimal');
          }
          const w = await sbWrite(env, `review_submissions?id=eq.${enc(adminDecide[1])}`, 'PATCH', { status: approve ? 'approved' : 'rejected', note: note || null, admin_username: user.username, decided_at: nowIso });
          if (!w.ok) return out(dbFail(w.detail));
          const appRows = await sbList<Row>(env, `apps?id=eq.${enc(appId)}&select=*`);
          const relRows = await sbList<Row>(env, `app_releases?id=eq.${enc(releaseId)}&select=*`);
          return out(json({ submission: w.rows[0] ? mapSubmission(w.rows[0], appRows[0], relRows[0]) : null }));
        }

        const adminAppAction = path.match(/^\/api\/admin\/apps\/([^/]+)\/(suspend|restore|unsuspend|feature)$/);
        if (adminAppAction && req.method === 'POST') {
          const app = await findApp(env, decodeURIComponent(adminAppAction[1]));
          if (!app) return out(err('not_found', 'App not found', 404));
          const appId = str(app.id);
          let patchRow: Row;
          if (adminAppAction[2] === 'suspend') patchRow = { status: 'suspended' };
          else if (adminAppAction[2] === 'feature') {
            const body = await readBody(req);
            const featured = body.featured == null ? null : str(body.featured);
            if (featured !== null && !['hero', 'editors', 'top_new'].includes(featured)) return out(err('bad_request', 'featured must be hero, editors, top_new, or null', 400));
            patchRow = { featured };
          } else {
            const live = await sbList<Row>(env, `app_releases?app_id=eq.${enc(appId)}&is_live=eq.true&select=id&limit=1`);
            patchRow = { status: live.length ? 'published' : 'draft' };
          }
          patchRow.updated_at = new Date().toISOString();
          const w = await sbWrite(env, `apps?id=eq.${enc(appId)}`, 'PATCH', patchRow);
          if (!w.ok) return out(dbFail(w.detail));
          const bundle = await bundleApps(env, w.rows.length ? w.rows : [app]);
          return out(json({ app: bundle.apps[0] }));
        }

        const adminReport = path.match(/^\/api\/admin\/reports\/([^/]+)\/resolve$/);
        if (adminReport && req.method === 'POST') {
          const body = await readBody(req);
          const status = str(body.status, 'resolved');
          if (!['resolved', 'dismissed', 'open'].includes(status)) return out(err('bad_request', 'Status must be resolved, dismissed, or open', 400));
          const w = await sbWrite(env, `reports?id=eq.${enc(adminReport[1])}`, 'PATCH', { status });
          if (!w.ok) return out(dbFail(w.detail));
          if (!w.rows.length) return out(err('not_found', 'Report not found', 404));
          const appRows = await sbList<Row>(env, `apps?id=eq.${enc(str(w.rows[0].app_id))}&select=*`);
          return out(json({ report: mapReport(w.rows[0], appRows[0]) }));
        }

        return out(err('not_found', 'Route not found', 404));
      }

      return out(err('not_found', 'Route not found', 404));
    } catch (e) {
      return out(err('server_error', e instanceof Error ? e.message : 'Internal server error', 500));
    }
  },
};
