import { ensureSchema, getDeveloperForUser, hasD1 } from './db';
import { attachSetCookie, brandFor, err, extractSetCookies, githubToken, json, readJson } from './http';
import { mapDeveloper, str } from './mappers';
import type { AccountSlotItem, AuthUser, Env, Row, SessionResolution } from './types';

export function authHubOrigin(env: Env): string {
  const raw = (env.AUTH_HUB_URL || env.ACCOUNTS_API_URL || brandFor(env).accountsApiUrl).trim();
  return raw.replace(/\/+$/, '').replace(/\/api$/, '');
}

export function isAdmin(user: AuthUser | null, env: Env): boolean {
  if (!user) return false;
  const list = (env.ADMIN_USERNAMES ?? 'pawan')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.username.toLowerCase());
}

export function resolveAuthuserHint(req: Request): number | null {
  const headerVal = req.headers.get('X-Gothwad-Authuser');
  if (headerVal !== null && /^[0-5]$/.test(headerVal.trim())) {
    return Number(headerVal.trim());
  }
  try {
    const u = new URL(req.url);
    const q = u.searchParams.get('authuser') ?? u.searchParams.get('u');
    if (q !== null && /^[0-5]$/.test(q.trim())) return Number(q.trim());
  } catch {
    /* ignore */
  }
  return null;
}

export function normalizeUser(raw: Record<string, unknown>, env: Env): AuthUser | null {
  const brand = brandFor(env);
  const rawUsername = String(raw.username ?? raw.preferred_username ?? '').trim().toLowerCase();
  const rawId = String(raw.id ?? raw.sub ?? rawUsername).trim();
  if (!rawUsername && !rawId) return null;

  const username = rawUsername || rawId.toLowerCase();
  const firstName = String(raw.first_name ?? raw.firstName ?? raw.given_name ?? '').trim();
  const lastName = String(raw.last_name ?? raw.lastName ?? raw.family_name ?? '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const name = String(raw.name ?? (fullName || username)).trim() || username;
  const email = String(raw.email ?? `${username}@${brand.appDomain}`).trim().toLowerCase();
  const picture = String(raw.avatar_url ?? raw.avatarUrl ?? raw.picture ?? '').trim() || undefined;

  return {
    id: rawId || username,
    username,
    name,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email,
    picture,
    avatarUrl: picture,
  };
}

function normalizeAccounts(
  rawAccounts: unknown,
  activeSlot: string | null,
  env: Env,
): AccountSlotItem[] {
  if (!Array.isArray(rawAccounts)) return [];
  const brand = brandFor(env);
  return rawAccounts
    .map((item, idx): AccountSlotItem | null => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      const id = String(r.id ?? r.slot ?? '').trim();
      const username = String(r.username ?? '').trim().toLowerCase();
      if (!id && !username) return null;
      const authuser = typeof r.authuser === 'number' ? r.authuser : idx;
      const firstName = String(r.firstName ?? r.first_name ?? '').trim();
      const lastName = String(r.lastName ?? r.last_name ?? '').trim();
      const name = String(
        r.name ?? ([firstName, lastName].filter(Boolean).join(' ') || username),
      ).trim();
      const email = String(r.email ?? `${username}@${brand.appDomain}`).trim().toLowerCase();
      const avatarUrl = String(r.avatarUrl ?? r.avatar_url ?? r.picture ?? '').trim() || null;
      const accountUrl = String(
        r.accountUrl ?? `${brand.accountsSignInUrl}/u/${authuser}/me`,
      ).trim();
      return {
        id: id || String(authuser),
        slot: id || String(authuser),
        authuser,
        username,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name,
        email,
        avatarUrl,
        picture: avatarUrl,
        accountUrl,
        lastUsedAt: r.lastUsedAt ? String(r.lastUsedAt) : undefined,
        active: activeSlot ? id === activeSlot : idx === 0,
      };
    })
    .filter((x): x is AccountSlotItem => x !== null);
}

export async function resolveSession(req: Request, env: Env): Promise<SessionResolution> {
  const base = authHubOrigin(env);
  const hint = resolveAuthuserHint(req);
  const auth = req.headers.get('Authorization');

  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) {
      try {
        let r = await fetch(`${base}/api/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (r.status === 404) {
          r = await fetch(`${base}/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
        }
        if (r.ok) {
          const u = (await r.json()) as Record<string, unknown>;
          const user = normalizeUser(u, env);
          if (user) {
            return {
              user,
              activeSlot: null,
              authuser: hint ?? 0,
              accounts: [],
              accountUrl: `${brandFor(env).accountsSignInUrl}/u/${hint ?? 0}/me`,
            };
          }
        } else if (r.status >= 500) {
          return {
            user: null,
            activeSlot: null,
            authuser: 0,
            accounts: [],
            upstreamUnavailable: true,
          };
        }
      } catch {
        return {
          user: null,
          activeSlot: null,
          authuser: 0,
          accounts: [],
          upstreamUnavailable: true,
        };
      }
    }
  }

  const cookie = req.headers.get('Cookie');
  if (cookie) {
    try {
      const headers: Record<string, string> = {
        Cookie: cookie,
        Accept: 'application/json',
      };
      if (hint !== null) {
        headers['X-Gothwad-Authuser'] = String(hint);
      }
      const r = await fetch(`${base}/api/auth/me`, { headers });
      attachSetCookie(req, extractSetCookies(r));

      if (r.status === 401 || r.status === 403) {
        return { user: null, activeSlot: null, authuser: hint ?? 0, accounts: [] };
      }
      if (!r.ok) {
        return {
          user: null,
          activeSlot: null,
          authuser: hint ?? 0,
          accounts: [],
          upstreamUnavailable: true,
        };
      }
      const d = (await r.json()) as Record<string, unknown>;
      const activeSlot =
        typeof d.activeId === 'string'
          ? d.activeId
          : typeof d.activeSlot === 'string'
            ? d.activeSlot
            : null;
      const authuser = typeof d.authuser === 'number' ? d.authuser : (hint ?? 0);
      const accounts = normalizeAccounts(d.accounts, activeSlot, env);
      const userObj =
        d.authenticated !== false && d.user && typeof d.user === 'object'
          ? normalizeUser(d.user as Record<string, unknown>, env)
          : null;

      return {
        user: userObj,
        activeSlot,
        authuser,
        accounts,
        accountUrl: `${brandFor(env).accountsSignInUrl}/u/${authuser}/me`,
      };
    } catch {
      return {
        user: null,
        activeSlot: null,
        authuser: hint ?? 0,
        accounts: [],
        upstreamUnavailable: true,
      };
    }
  }

  return { user: null, activeSlot: null, authuser: hint ?? 0, accounts: [] };
}

export async function verifyUser(req: Request, env: Env): Promise<AuthUser | null> {
  const session = await resolveSession(req, env);
  return session.user;
}

export async function handleMe(req: Request, env: Env): Promise<Response> {
  const session = await resolveSession(req, env);
  if (session.upstreamUnavailable) {
    return err('auth_unavailable', 'Gothwad Accounts service is temporarily unavailable', 503);
  }
  const { user, activeSlot, authuser, accounts, accountUrl } = session;
  if (!user) {
    return json(
      {
        authenticated: false,
        error: 'unauthorized',
        message: 'Please sign in with Gothwad',
        user: null,
        developer: null,
        isAdmin: false,
        activeSlot,
        activeId: activeSlot,
        authuser,
        accounts,
      },
      401,
    );
  }

  let developer: ReturnType<typeof mapDeveloper> | null = null;
  if (hasD1(env)) {
    await ensureSchema(env.DB, env);
    const devRow = await getDeveloperForUser(env.DB, user);
    if (devRow) developer = mapDeveloper(devRow);
  }
  const d1Ready = hasD1(env);
  const ghReady = Boolean(githubToken(env));
  return json({
    authenticated: true,
    user,
    developer,
    isAdmin: isAdmin(user, env),
    activeSlot,
    activeId: activeSlot,
    authuser,
    accounts,
    accountUrl,
    configured: {
      d1: d1Ready,
      images: d1Ready,
      github: ghReady,
      githubFiles: ghReady,
      auth: true,
    },
  });
}

export async function handleAuthExchange(req: Request, env: Env): Promise<Response> {
  const body = await readJson<Row>(req);
  if (!body?.code) return err('bad_request', 'Missing authorization code', 400);
  const base = authHubOrigin(env);
  const payload = JSON.stringify({
    grant_type: 'authorization_code',
    client_id: env.OAUTH_CLIENT_ID ?? 'kiwi-store',
    code: body.code,
    redirect_uri: body.redirectUri ?? body.redirect_uri,
    code_verifier: body.codeVerifier ?? body.code_verifier,
  });
  let tokenRes = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: payload,
  });
  if (tokenRes.status === 404) {
    tokenRes = await fetch(`${base}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payload,
    });
  }
  attachSetCookie(req, extractSetCookies(tokenRes));
  if (!tokenRes.ok) {
    return err('exchange_failed', 'Authorization code exchange failed', 401);
  }
  const tokens = (await tokenRes.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = str(tokens.access_token ?? tokens.accessToken);
  const refreshToken = str(tokens.refresh_token ?? tokens.refreshToken) || undefined;
  let user: AuthUser | null = null;
  if (tokens.user && typeof tokens.user === 'object') {
    user = normalizeUser(tokens.user as Record<string, unknown>, env);
  } else if (accessToken) {
    user = await verifyUser(
      new Request(req.url, { headers: { Authorization: `Bearer ${accessToken}` } }),
      env,
    );
  }
  return json({
    accessToken,
    refreshToken,
    access_token: accessToken,
    refresh_token: refreshToken,
    expiresIn: tokens.expires_in ?? tokens.expiresIn,
    user,
  });
}

export async function handleAuthSignOut(
  req: Request,
  env: Env,
  slotId?: string,
): Promise<Response> {
  const base = authHubOrigin(env);
  const cookie = req.headers.get('Cookie') ?? '';
  const body = await readJson<Row>(req);
  const targetSlot = slotId || (body?.slot ? str(body.slot) : body?.id ? str(body.id) : '');
  const upstreamPath = targetSlot
    ? `/api/auth/accounts/${encodeURIComponent(targetSlot)}/signout`
    : '/api/auth/signout';

  let upstreamData: Record<string, unknown> = {};
  if (cookie) {
    try {
      const headers: Record<string, string> = {
        Cookie: cookie,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      const hint = resolveAuthuserHint(req);
      if (hint !== null) headers['X-Gothwad-Authuser'] = String(hint);
      const r = await fetch(`${base}${upstreamPath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {}),
      });
      attachSetCookie(req, extractSetCookies(r));
      upstreamData = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    } catch {
      /* fallback below */
    }
  }

  if (!targetSlot) {
    const domain = brandFor(env).appDomain;
    const clearCookies = [
      'gothwad_at',
      'gothwad_rt',
      'gothwad_sid',
      'gothwad_active',
      'gothwad_accounts',
    ].map(
      (name) =>
        `${name}=; Domain=.${domain}; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`,
    );
    attachSetCookie(req, clearCookies);
  }

  return json({ ok: true, signedOut: true, ...upstreamData });
}

export async function handleAuthAccounts(req: Request, env: Env): Promise<Response> {
  const session = await resolveSession(req, env);
  if (session.upstreamUnavailable) {
    return err('auth_unavailable', 'Gothwad Accounts service is temporarily unavailable', 503);
  }
  return json({
    authenticated: Boolean(session.user),
    activeId: session.activeSlot,
    activeSlot: session.activeSlot,
    authuser: session.authuser,
    accounts: session.accounts,
  });
}

export async function handleAuthSwitch(req: Request, env: Env): Promise<Response> {
  const base = authHubOrigin(env);
  const cookie = req.headers.get('Cookie') ?? '';
  const body = (await readJson<Row>(req)) ?? {};
  if (!cookie) return err('unauthorized', 'No active session cookie', 401);

  try {
    const r = await fetch(`${base}/api/auth/switch`, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    attachSetCookie(req, extractSetCookies(r));
    const data = await r.json().catch(() => ({}));
    return json(data, r.status);
  } catch {
    return err('auth_unavailable', 'Accounts switch service unavailable', 503);
  }
}
