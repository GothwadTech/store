// ═══════════════════════════════════════════════════════════════════
// GOTHWAD STORE WORKER - ek hi API chaaro cheezon ke liye:
//   store.gothwadtech.com · console.gothwadtech.com
//   admin.console.gothwadtech.com · storeapp.gothwadtech.com · Android app
//
// Pakke niyam (PLAN.md):
//  · Supabase = Store ka APNA project, SIRF database (Storage bilkul nahi)
//  · Images  -> ImgBB            (IMGBB_API_KEY)
//  · APK <=25MB -> GitHub store-files repo   (GITHUB_FILES_TOKEN)
//  · APK  >25MB -> Backblaze B2 (S3 API)     (B2_KEY_ID/B2_APP_KEY)
//  · Login   -> Gothwad Accounts OAuth/cookie (khud ka password system NAHI)
//  · SERVICE ROLE KEY sirf yahi rahegi, frontend me kabhi nahi
// ═══════════════════════════════════════════════════════════════════

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

const APK_GITHUB_LIMIT = 25 * 1024 * 1024;

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
  const ok = allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /\.e2b\.app$/.test(new URL(origin || 'http://x').hostname ?? '');
  return ok && origin
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' }
    : {};
}

const dbConfigured = (env: Env) => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

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
  return (await r.json()) as T;
}

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
  } catch { /* Accounts down ho to null - caller 401/503 tay karega */ }
  return null;
}

const isAdmin = (env: Env, u: GothwadUser | null) =>
  !!u && env.ADMIN_USERNAMES.split(',').map((s) => s.trim()).includes(u.username);

// ── Backblaze B2 (S3 SigV4 presigned PUT) ───────────────────────────
async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
}
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function b2PresignedPut(env: Env, key: string, contentType: string, expiresSec = 3600): Promise<string> {
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
  void contentType;
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
  if (!rel.ok) throw new Error('github_release_failed');
  const release = (await rel.json()) as { upload_url: string };
  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const up = await fetch(uploadUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/vnd.android.package-archive' }, body: bytes });
  if (!up.ok) throw new Error('github_asset_failed');
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
          const rows = await sbJson<unknown[]>(env, `developers?user_id=eq.${user.id}&select=*`);
          developer = rows?.[0] ?? null;
        }
        return out(json({ user, developer, isAdmin: isAdmin(env, user) }));
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
        return out(json({ categories: await sbJson(env, 'categories?select=*&order=name') ?? [] }));
      }

      if (path === '/api/store/home' || path === '/api/store/apps') {
        if (!dbConfigured(env)) return out(json({ apps: [], source: 'unconfigured', message: 'Supabase is not configured; the frontend is showing demo data' }));
        const kind = url.searchParams.get('kind');
        const category = url.searchParams.get('category');
        const q = url.searchParams.get('q');
        let query = 'apps?status=eq.published&select=*&order=downloads_count.desc&limit=100';
        if (kind) query += `&kind=eq.${kind}`;
        if (category) query += `&category=eq.${category}`;
        if (q) query += `&name=ilike.*${encodeURIComponent(q)}*`;
        return out(json({ apps: await sbJson(env, query) ?? [] }));
      }

      const appMatch = path.match(/^\/api\/store\/apps\/(.+)$/);
      if (appMatch && req.method === 'GET') {
        if (!dbConfigured(env)) return out(err('unconfigured', 'Supabase is not configured', 503));
        const pkg = decodeURIComponent(appMatch[1]);
        const apps = await sbJson<Record<string, unknown>[]>(env, `apps?package_name=eq.${encodeURIComponent(pkg)}&select=*`);
        if (!apps?.length) return out(err('not_found', 'App not found', 404));
        const app = apps[0];
        const [screenshots, releases, reviews] = await Promise.all([
          sbJson(env, `app_screenshots?app_id=eq.${app.id}&select=*&order=sort_order`),
          sbJson(env, `app_releases?app_id=eq.${app.id}&is_live=eq.true&select=*&order=version_code.desc&limit=1`),
          sbJson(env, `reviews?app_id=eq.${app.id}&select=*&order=created_at.desc&limit=50`),
        ]);
        return out(json({ app, screenshots: screenshots ?? [], liveRelease: (releases as unknown[])?.[0] ?? null, reviews: reviews ?? [] }));
      }

      // Download: pehle count, phir asal file (GitHub/B2) par redirect
      const dlMatch = path.match(/^\/api\/download\/(.+)$/);
      if (dlMatch) {
        if (!dbConfigured(env)) return out(err('unconfigured', 'Supabase is not configured; demo downloads are unavailable', 503));
        const rels = await sbJson<{ id: string; app_id: string; apk_url: string }[]>(env, `app_releases?id=eq.${dlMatch[1]}&select=id,app_id,apk_url`);
        if (!rels?.length) return out(err('not_found', 'Release not found', 404));
        const user = await verifyUser(req, env);
        void sb(env, 'downloads', { method: 'POST', body: JSON.stringify({ app_id: rels[0].app_id, release_id: rels[0].id, user_id: user?.id ?? null }) });
        return out(new Response(null, { status: 302, headers: { Location: rels[0].apk_url } }));
      }

      // ── Login zaroori wale hisse ──────────────────────────
      const needsDb: [boolean, string][] = [
        [path.startsWith('/api/dev'), 'dev'], [path.startsWith('/api/admin'), 'admin'],
        [path.startsWith('/api/uploads'), 'uploads'], [/^\/api\/store\/apps\/[^/]+\/(reviews|wishlist|report)$/.test(path), 'user'],
      ];
      void needsDb;
      if (path.startsWith('/api/dev') || path.startsWith('/api/admin') || path.startsWith('/api/uploads') || /\/api\/store\/apps\/[^/]+\/(reviews|wishlist|report)$/.test(path)) {
        const user = await verifyUser(req, env);
        if (!user) return out(err('unauthorized', 'Please sign in with Gothwad', 401));
        if (!dbConfigured(env)) return out(err('supabase_not_configured', 'The Store Supabase project is not configured yet (SUPABASE_URL / SERVICE_ROLE_KEY)', 503));
        if (path.startsWith('/api/admin') && !isAdmin(env, user)) return out(err('forbidden', 'Admin access required', 403));

        // ── Uploads ─────────────────────────────────────
        if (path === '/api/uploads/image' && req.method === 'POST') {
          // Saari images ImgBB par. Browser pehle hi resize/compress karke bhejta hai.
          if (!env.IMGBB_API_KEY) return out(err('imgbb_not_configured', 'IMGBB_API_KEY is not configured', 503));
          const form = await req.formData();
          const image = form.get('image');
          if (!image) return out(err('bad_request', 'An image file is required', 400));
          const up = new FormData();
          up.append('image', image);
          const r = await fetch(`https://api.imgbb.com/1/upload?key=${env.IMGBB_API_KEY}`, { method: 'POST', body: up });
          const d = (await r.json()) as { data?: { url: string; delete_url: string }; success?: boolean };
          if (!d.success || !d.data) return out(err('imgbb_failed', 'ImgBB upload failed', 502));
          return out(json({ provider: 'imgbb', url: d.data.url, deleteUrl: d.data.delete_url }));
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
          const uploadUrl = await b2PresignedPut(env, key, body.contentType ?? 'application/vnd.android.package-archive');
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
          const downloadUrl = await githubUploadApk(env, packageName, versionCode, file.name, await file.arrayBuffer());
          return out(json({ provider: 'github', url: downloadUrl, key: `${packageName}@${versionCode}/${file.name}` }));
        }

        // Baaki /api/dev/* aur /api/admin/* ka CRUD agle phase me isi file me
        // tables (developers/apps/app_releases/submissions) par lagega.
        return out(err('not_implemented_yet', 'This endpoint is not implemented yet; the frontend currently runs on local state', 501));
      }

      return out(err('not_found', 'Route not found', 404));
    } catch (e) {
      return out(err('server_error', e instanceof Error ? e.message : 'Internal server error', 500));
    }
  },
};
