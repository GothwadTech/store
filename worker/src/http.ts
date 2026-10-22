import { isBrandHost, resolveBrand, type Brand } from '../../shared/brand';
import { sha256Hex } from './apk';
import type { Env } from './types';

const pendingCookies = new WeakMap<Request, string[]>();

export const brandFor = (env: Env): Brand =>
  resolveBrand(env as unknown as Record<string, unknown>, { prefix: '' });

export const githubToken = (env: Env): string =>
  (env.GITHUB_FILES_TOKEN || env.GITHUB_STOREFILES_TOKEN || '').trim();

export function githubOwnerRepo(env: Env): { owner: string; repo: string } {
  const combined = (env.GITHUB_REPO || env.GITHUB_FILES_REPO || '').trim();
  if (combined.includes('/')) {
    const [o, r] = combined.split('/');
    if (o && r) return { owner: o.trim(), repo: r.trim() };
  }
  return {
    owner: (env.GITHUB_FILES_OWNER || 'GothwadTech').trim(),
    repo: (env.GITHUB_FILES_REPO || 'storefiles').trim(),
  };
}

export function canonicalStoreOrigin(req: Request, env: Env): string {
  const brand = brandFor(env);
  try {
    const u = new URL(req.url);
    if (isBrandHost(u.hostname, brand.appDomain)) {
      return brand.storePublicUrl;
    }
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    const proto = isLocal ? u.protocol : 'https:';
    return `${proto}//${u.host}`;
  } catch {
    return brand.storePublicUrl;
  }
}

export function extractSetCookies(res: Response): string[] {
  const hdrs = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof hdrs.getSetCookie === 'function') {
    const list = hdrs.getSetCookie().filter(Boolean);
    if (list.length > 0) return list;
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

export function attachSetCookie(req: Request, cookies: string | string[]): void {
  const list = Array.isArray(cookies) ? cookies : [cookies];
  const filtered = list.map((c) => c.trim()).filter(Boolean);
  if (filtered.length === 0) return;
  const existing = pendingCookies.get(req) ?? [];
  for (const c of filtered) {
    if (!existing.includes(c)) existing.push(c);
  }
  pendingCookies.set(req, existing);
}

export function getPendingSetCookies(req: Request): string[] {
  return pendingCookies.get(req) ?? [];
}

export function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const brand = brandFor(env);
  const defaults = [
    ...Object.values(brand.siteUrls),
    brand.accountsSignInUrl,
    brand.accountsApiUrl,
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const extra = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set([...defaults, ...extra]);
  let allowOrigin = brand.siteUrls.store;
  try {
    if (origin && (allowed.has(origin) || isBrandHost(new URL(origin).hostname, brand.appDomain))) {
      allowOrigin = origin;
    } else if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      allowOrigin = origin;
    }
  } catch {
    /* keep default */
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gothwad-Authuser, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag, Content-Length, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Cookie, X-Gothwad-Authuser',
  };
}

export function withCorsAndCookies(req: Request, env: Env, res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeaders(req, env);
  for (const [k, v] of Object.entries(cors)) {
    if (!headers.has(k) || k.startsWith('Access-Control-')) {
      headers.set(k, v);
    }
  }
  for (const cookie of getPendingSetCookies(req)) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

export const err = (code: string, message: string, status = 400): Response =>
  json({ error: code, message }, status);

export const noContent = (req: Request, env: Env): Response =>
  new Response(null, { status: 204, headers: corsHeaders(req, env) });

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function ipHash(req: Request): Promise<string> {
  const ip =
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    '0.0.0.0';
  const day = new Date().toISOString().slice(0, 10);
  const hex = await sha256Hex(new TextEncoder().encode(`${ip}:${day}:kiwi-store`));
  return hex.slice(0, 24);
}
