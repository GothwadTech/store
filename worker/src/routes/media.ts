import { parseApkManifest, sha256Hex } from '../apk';
import { isAdmin, verifyUser } from '../auth';
import { ensureSchema, findApp, getDeveloperForUser, hasD1 } from '../db';
import { handleFdroidDownload } from '../fdroid';
import { brandFor, canonicalStoreOrigin, err, githubOwnerRepo, githubToken, json, readJson } from '../http';
import { num, str, toBool } from '../mappers';
import type { AuthUser, D1Database, Env, ExecutionContext, Row } from '../types';

export const MAX_APK_SIZE = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 400_000;
const APK_PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function validApkName(name: string): boolean {
  return /\.apk$/i.test(name) && !/[\\/\0]/.test(name);
}

export function detectImageMagic(bytes: Uint8Array): 'image/webp' | 'image/png' | 'image/jpeg' | null {
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

function decodeBase64(b64: string): Uint8Array {
  const cleaned = b64.replace(/^data:[^;]+;base64,/, '').trim();
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return new Uint8Array(data);
  return new Uint8Array(0);
}

export async function handleImageUpload(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet; uploads are unavailable.', 503);
  await ensureSchema(env.DB, env);

  const ct = (req.headers.get('Content-Type') ?? '').toLowerCase();
  let bytes: Uint8Array | null = null;
  let kind: 'icon' | 'screenshot' | 'banner' = 'screenshot';
  let width: number | null = null;
  let height: number | null = null;

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const file = (form?.get('image') ?? form?.get('file')) as File | null;
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return err('bad_request', 'An image file is required', 400);
    }
    const rawKind = String(form?.get('kind') ?? 'screenshot').toLowerCase();
    if (rawKind === 'icon' || rawKind === 'screenshot' || rawKind === 'banner') kind = rawKind;
    const w = Number(form?.get('width'));
    const h = Number(form?.get('height'));
    if (Number.isFinite(w) && w > 0) width = Math.round(w);
    if (Number.isFinite(h) && h > 0) height = Math.round(h);
    bytes = new Uint8Array(await file.arrayBuffer());
  } else if (ct.includes('application/json')) {
    const body = await readJson<Row>(req);
    const b64 = String(body?.data ?? body?.image ?? body?.image_base64 ?? '').trim();
    if (!b64) return err('bad_request', 'Missing base64 image data', 400);
    const rawKind = String(body?.kind ?? 'screenshot').toLowerCase();
    if (rawKind === 'icon' || rawKind === 'screenshot' || rawKind === 'banner') kind = rawKind;
    if (Number.isFinite(Number(body?.width)) && Number(body?.width) > 0) width = Math.round(Number(body?.width));
    if (Number.isFinite(Number(body?.height)) && Number(body?.height) > 0) height = Math.round(Number(body?.height));
    try {
      bytes = decodeBase64(b64);
    } catch {
      return err('bad_request', 'Invalid base64 image payload', 400);
    }
  } else {
    const buf = await req.arrayBuffer().catch(() => null);
    if (buf && buf.byteLength > 0) bytes = new Uint8Array(buf);
  }

  if (!bytes || bytes.byteLength === 0) return err('bad_request', 'The image file is empty.', 400);
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return err('image_too_large', `Image is ${Math.round(bytes.byteLength / 1024)} KB — max allowed post-compression size is 400 KB.`, 413);
  }

  const detectedMime = detectImageMagic(bytes);
  if (!detectedMime) {
    return err('unsupported_image', 'Choose a valid PNG, JPG, or WebP image (verified by binary magic bytes).', 415);
  }

  const sha256 = await sha256Hex(bytes);
  const existing = await env.DB.prepare(
    'SELECT id, sha256, mime_type, byte_size, width, height FROM store_images WHERE sha256 = ? LIMIT 1',
  ).bind(sha256).first<Row>();

  let imageId: string;
  if (existing?.id) {
    imageId = str(existing.id);
  } else {
    imageId = `img-${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO store_images (id, sha256, owner_username, kind, mime_type, byte_size, width, height, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(imageId, sha256, user.username.toLowerCase(), kind, detectedMime, bytes.byteLength, width, height, bytes, new Date().toISOString()).run();
  }

  const origin = canonicalStoreOrigin(req, env);
  const url = `${origin}/api/images/${encodeURIComponent(imageId)}?v=${sha256.slice(0, 12)}`;
  return json({ ok: true, id: imageId, provider: 'd1', url, sha256, mimeType: detectedMime, sizeBytes: bytes.byteLength });
}

function matchesEtag(ifNoneMatch: string | null, sha256: string): boolean {
  if (!ifNoneMatch) return false;
  const targets = ifNoneMatch.split(',').map((s) => s.trim());
  return targets.includes('*') || targets.includes(`"${sha256}"`) || targets.includes(`W/"${sha256}"`) || targets.includes(sha256);
}

export async function handleGetImage(req: Request, env: Env, imageId: string, ctx?: ExecutionContext): Promise<Response> {
  if (!hasD1(env)) return err('d1_not_configured', 'Cloudflare D1 is not configured', 503);
  await ensureSchema(env.DB, env);

  const reqUrl = new URL(req.url);
  const cacheKeyUrl = new URL(`/api/images/${encodeURIComponent(imageId)}${reqUrl.search}`, reqUrl.origin).toString();
  const cacheKey = new Request(cacheKeyUrl, { method: 'GET' });
  const edgeCache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const ifNoneMatch = req.headers.get('If-None-Match');

  if (edgeCache) {
    try {
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        const cachedEtag = (cached.headers.get('ETag') ?? '').replace(/^W\/|^"|"$/g, '');
        if (cachedEtag && matchesEtag(ifNoneMatch, cachedEtag)) {
          return new Response(null, { status: 304, headers: cached.headers });
        }
        return req.method === 'HEAD' ? new Response(null, { status: 200, headers: cached.headers }) : cached;
      }
    } catch { /* continue to D1 on cache error */ }
  }

  const row = await env.DB.prepare('SELECT id, sha256, mime_type, byte_size, data FROM store_images WHERE id = ? LIMIT 1')
    .bind(imageId).first<Row>();
  if (!row) return err('not_found', 'Image not found', 404);

  const sha256 = str(row.sha256);
  const mimeType = str(row.mime_type, 'image/webp');
  const bytes = toUint8Array(row.data);
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Content-Length': String(bytes.byteLength),
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: `"${sha256}"`,
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };

  const fullResponse = new Response(bytes as unknown as BodyInit, { status: 200, headers });
  if (edgeCache) {
    const putPromise = edgeCache.put(cacheKey, fullResponse.clone()).catch(() => undefined);
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(putPromise);
    else await putPromise;
  }

  if (matchesEtag(ifNoneMatch, sha256)) return new Response(null, { status: 304, headers });
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers });
  return fullResponse;
}

export async function handleApkInspect(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string' || !validApkName(file.name)) {
    return err('bad_request', 'Choose an Android APK file (.apk).', 400);
  }
  if (!file.size || file.size > MAX_APK_SIZE) {
    return err('apk_too_large', 'APK must be between 1 byte and 50 MB.', 413);
  }
  const bytes = await file.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    return err('invalid_apk', 'This file is not a valid APK archive.', 400);
  }
  const [manifest, sha256] = await Promise.all([parseApkManifest(bytes), sha256Hex(bytes)]);
  return json({ manifest, sizeBytes: file.size, sha256 });
}

async function ownsPackage(
  db: D1Database,
  user: AuthUser,
  env: Env,
  packageName: string,
): Promise<{ app: Row; developer: Row } | { error: Response }> {
  const developer = await getDeveloperForUser(db, user);
  if (!developer && !isAdmin(user, env)) {
    return { error: err('developer_required', 'Create a developer profile before uploading files', 403) };
  }
  const app = await findApp(db, packageName);
  if (!app || str(app.package_name) !== packageName) {
    return { error: err('not_found', 'Create this app listing before uploading its APK', 404) };
  }
  if (developer && str(app.developer_id) !== str(developer.id) && !isAdmin(user, env)) {
    return { error: err('forbidden', 'This app does not belong to your developer profile', 403) };
  }
  return { app, developer: developer ?? { id: str(app.developer_id) } };
}

async function githubUploadApk(
  env: Env,
  packageName: string,
  versionCode: number,
  fileName: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const { owner, repo } = githubOwnerRepo(env);
  const token = githubToken(env);
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kiwi-store-worker',
  };
  const tag = `${packageName}@${versionCode}`;
  let response = await fetch(`${base}/releases/tags/${encodeURIComponent(tag)}`, { headers });
  if (response.status === 404) {
    response = await fetch(`${base}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tag, name: `${packageName} v${versionCode}`, body: `Uploaded by ${brandFor(env).appName}` }),
    });
  }
  if (!response.ok) throw new Error(`GitHub release setup failed (${response.status})`);
  const release = (await response.json()) as { id: number; upload_url: string; assets?: { id: number; name: string }[] };

  const duplicate = release.assets?.find((asset) => asset.name === fileName);
  if (duplicate) {
    const removed = await fetch(`${base}/releases/assets/${duplicate.id}`, { method: 'DELETE', headers });
    if (!removed.ok && removed.status !== 404) {
      throw new Error(`GitHub could not replace the previous upload (${removed.status})`);
    }
  }

  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/vnd.android.package-archive' },
    body: bytes,
  });
  if (!uploaded.ok) throw new Error(`GitHub asset upload failed (${uploaded.status})`);
  const asset = (await uploaded.json()) as { browser_download_url: string };
  return asset.browser_download_url;
}

export async function handleApkUpload(req: Request, env: Env): Promise<Response> {
  const user = await verifyUser(req, env);
  if (!user) return err('unauthorized', 'Please sign in with Gothwad', 401);
  if (!hasD1(env)) return err('d1_not_configured', 'The Store database is not configured yet; uploads are unavailable.', 503);
  await ensureSchema(env.DB, env);
  if (!githubToken(env)) return err('github_not_configured', 'APK hosting is not configured yet. Please try again later.', 503);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const packageName = String(form?.get('packageName') ?? '').trim().toLowerCase();
  const versionCode = Number(form?.get('versionCode') ?? 0);
  if (!file || typeof file === 'string' || !APK_PACKAGE_RE.test(packageName) || !Number.isInteger(versionCode) || versionCode < 1) {
    return err('bad_request', 'A valid APK file, package name, and positive version code are required.', 400);
  }
  if (!validApkName(file.name)) return err('bad_request', 'Choose an Android APK file (.apk).', 400);
  if (!file.size || file.size > MAX_APK_SIZE) return err('apk_too_large', 'The reliable APK upload limit is 50 MB.', 413);

  const owned = await ownsPackage(env.DB, user, env, packageName);
  if ('error' in owned) return owned.error;

  const bytes = await file.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    return err('invalid_apk', 'This file is not a valid APK archive.', 400);
  }
  const [manifest, sha256] = await Promise.all([parseApkManifest(bytes), sha256Hex(bytes)]);
  if (manifest.packageName && manifest.packageName !== packageName) {
    return err('package_mismatch', `The APK package (${manifest.packageName}) does not match this listing (${packageName}).`, 400);
  }

  const downloadUrl = await githubUploadApk(env, packageName, versionCode, file.name, bytes);
  return json({
    provider: 'github',
    url: downloadUrl,
    key: `${packageName}@${versionCode}/${file.name}`,
    manifest,
    sha256,
    sizeBytes: file.size,
  });
}

export async function handleApkDownload(req: Request, env: Env, releaseId: string): Promise<Response> {
  if (releaseId.toLowerCase().startsWith('fdroid:')) {
    return handleFdroidDownload(req, env, releaseId);
  }
  if (!hasD1(env)) return err('unconfigured', 'The Store database is not configured yet; downloads are unavailable.', 503);
  await ensureSchema(env.DB, env);

  const rel = await env.DB.prepare('SELECT * FROM app_releases WHERE id = ? LIMIT 1').bind(releaseId).first<Row>();
  if (!rel) return err('not_found', 'Release not found', 404);
  if (!toBool(rel.is_live) || !str(rel.apk_url)) return err('not_found', 'Release file not found', 404);

  const appId = str(rel.app_id);
  const liveApp = await env.DB.prepare(`SELECT id FROM apps WHERE id = ? AND status = 'published' LIMIT 1`).bind(appId).first<Row>();
  if (!liveApp) return err('not_found', 'Release file not found', 404);

  const user = await verifyUser(req, env);
  const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const hash = await sha256Hex(new TextEncoder().encode(`${ip}|${appId}|${day}`));
  const already = await env.DB.prepare('SELECT id FROM downloads WHERE ip_hash = ? LIMIT 1').bind(hash).first<Row>();

  const now = new Date().toISOString();
  const batchStmts = [];
  if (!already) {
    batchStmts.push(
      env.DB.prepare(
        `INSERT INTO downloads (app_id, release_id, user_id, ip_hash, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(appId, str(rel.id), user?.id ?? null, hash, req.headers.get('User-Agent') ?? null, now),
      env.DB.prepare('UPDATE apps SET downloads_count = downloads_count + 1, updated_at = ? WHERE id = ?').bind(now, appId),
      env.DB.prepare('UPDATE app_releases SET downloads = downloads + 1 WHERE id = ?').bind(str(rel.id)),
    );
  }
  if (user) {
    batchStmts.push(
      env.DB.prepare(
        `INSERT INTO library (user_id, app_id, first_downloaded_at, last_version_code) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, app_id) DO UPDATE SET last_version_code = excluded.last_version_code`,
      ).bind(user.id, appId, now, num(rel.version_code)),
    );
  }
  if (batchStmts.length > 0) await env.DB.batch(batchStmts);
  return new Response(null, { status: 302, headers: { Location: str(rel.apk_url) } });
}
