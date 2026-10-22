// ═══════════════════════════════════════════════════════════════════
// KIWI STORE — app name + domains ka EK HI source of truth.
//
// Niyam: kisi bhi component / worker / html me domain ya brand name
// hardcode NAHI karna. Sab kuch yahan se aata hai aur env se override hota hai:
//   · Frontend (browser) : src/lib/config.ts   -> resolveBrand(import.meta.env)
//   · Build (index.html, manifest.json) : vite.config.ts -> resolveBrand(process.env)
//   · Worker (API/CORS)  : worker/src/index.ts -> resolveBrand(env, { prefix: '' })
//
// Domain badalna ho to code touch karne ki zaroorat NAHI:
//   Pages  → environment variable  VITE_APP_DOMAIN (ya VITE_STORE_URL etc.)
//   Worker → variable APP_DOMAIN / STORE_HOST etc. (dashboard ya wrangler.toml)
// App name badalna ho to VITE_APP_NAME / APP_NAME.
//
// Yeh file bilkul pure hai (koi DOM / node import nahi) taaki browser, vite
// config aur Worker teeno isko import kar sakein.
// ═══════════════════════════════════════════════════════════════════

export type SiteMode = 'store' | 'console' | 'admin' | 'storeapp';

export const SITE_MODES: { id: SiteMode; label: string }[] = [
  { id: 'store', label: 'Store' },
  { id: 'console', label: 'Console' },
  { id: 'admin', label: 'Admin' },
  { id: 'storeapp', label: 'Store App' },
];

/** Har site ka default subdomain. Poora URL = https://<host>.<appDomain>. */
export const DEFAULT_SITE_HOSTS: Record<SiteMode, string> = {
  store: 'kiwistore',
  console: 'kiwiconsole',
  admin: 'kiwiadmin',
  storeapp: 'kiwiapp',
};

export const BRAND_DEFAULTS = {
  appName: 'Kiwi Store',
  shortName: 'Kiwi',
  appDomain: 'gothwadtech.com',
  /** Ecosystem ka naam (Mail/Drive/Store sab isi ke under) - Accounts isi se banta hai. */
  ecosystemName: 'Gothwad',
  /** Store ki apni Android app ka package (APK wahi rahega jab tak rebuild na ho). */
  storeappPackage: 'com.gothwad.store',
  accountsApiUrl: 'https://api.gothwadtech.com',
  accountsSignInUrl: 'https://accounts.gothwadtech.com',
  oauthClientId: 'kiwi-store',
  apiBase: '/api',
} as const;

export interface Brand {
  appName: string;
  shortName: string;
  appDomain: string;
  ecosystemName: string;
  accountsName: string;
  storeappPackage: string;
  accountsApiUrl: string;
  accountsSignInUrl: string;
  accountsHost: string;
  oauthClientId: string;
  apiBase: string;
  storePublicUrl: string;
  siteHosts: Record<SiteMode, string>;
  siteUrls: Record<SiteMode, string>;
}

/** Env keys (prefix ke saath) - pehla match jeetta hai, baaki fallback hain. */
const ENV_KEYS = {
  appName: ['APP_NAME'],
  shortName: ['APP_SHORT_NAME'],
  appDomain: ['APP_DOMAIN'],
  ecosystemName: ['ECOSYSTEM_NAME'],
  storeappPackage: ['STOREAPP_PACKAGE'],
  accountsName: ['ACCOUNTS_NAME'],
  accountsApiUrl: ['ACCOUNTS_API_URL', 'AUTH_HUB_URL', 'GOTHWAD_AUTH_URL'],
  accountsSignInUrl: ['ACCOUNTS_SIGNIN_URL', 'ACCOUNTS_WEB_URL', 'GOTHWAD_SIGNIN_URL', 'AUTH_SIGNIN_URL'],
  oauthClientId: ['OAUTH_CLIENT_ID', 'GOTHWAD_CLIENT_ID'],
  apiBase: ['API_BASE'],
} as const;

const SITE_ENV_KEYS: Record<SiteMode, { host: string[]; url: string[] }> = {
  store: { host: ['STORE_HOST'], url: ['STORE_URL', 'STORE_PUBLIC_URL'] },
  console: { host: ['CONSOLE_HOST'], url: ['CONSOLE_URL'] },
  admin: { host: ['ADMIN_HOST'], url: ['ADMIN_URL'] },
  storeapp: { host: ['STOREAPP_HOST'], url: ['STOREAPP_URL'] },
};

const trimSlash = (value: string) => value.replace(/\/+$/, '');
const hostOf = (url: string): string | null => {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
};

function pick(env: Record<string, unknown>, prefix: string, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const raw = env[prefix + key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return undefined;
}

/**
 * Env (browser: import.meta.env, build: process.env, Worker: env) se poora
 * brand + site map banata hai. Jo value env me nahi hai uska default yahi hai.
 */
export function resolveBrand(rawEnv: Record<string, unknown> = {}, opts: { prefix?: string } = {}): Brand {
  const env = rawEnv ?? {};
  const prefix = opts.prefix ?? 'VITE_';
  const str = (keys: readonly string[], fallback: string) => pick(env, prefix, keys) ?? fallback;

  const appDomain = str(ENV_KEYS.appDomain, BRAND_DEFAULTS.appDomain)
    .toLowerCase()
    .replace(/^\.+/, '')
    .replace(/\/+$/, '');

  const accountsSignInUrl = trimSlash(str(ENV_KEYS.accountsSignInUrl, BRAND_DEFAULTS.accountsSignInUrl));
  const ecosystemName = str(ENV_KEYS.ecosystemName, BRAND_DEFAULTS.ecosystemName);

  const siteHosts = {} as Record<SiteMode, string>;
  const siteUrls = {} as Record<SiteMode, string>;
  for (const { id } of SITE_MODES) {
    const overrideUrl = pick(env, prefix, SITE_ENV_KEYS[id].url);
    if (overrideUrl) {
      // Poora URL diya hai (dusra zone / custom hostname) - wahi chalega.
      siteUrls[id] = trimSlash(overrideUrl);
      siteHosts[id] = hostOf(overrideUrl) ?? `${DEFAULT_SITE_HOSTS[id]}.${appDomain}`;
      continue;
    }
    const host = (pick(env, prefix, SITE_ENV_KEYS[id].host) ?? DEFAULT_SITE_HOSTS[id]).toLowerCase();
    siteHosts[id] = host;
    siteUrls[id] = `https://${host}.${appDomain}`;
  }

  return {
    appName: str(ENV_KEYS.appName, BRAND_DEFAULTS.appName),
    shortName: str(ENV_KEYS.shortName, BRAND_DEFAULTS.shortName),
    appDomain,
    ecosystemName,
    accountsName: str(ENV_KEYS.accountsName, `${ecosystemName} Accounts`),
    storeappPackage: str(ENV_KEYS.storeappPackage, BRAND_DEFAULTS.storeappPackage),
    accountsApiUrl: trimSlash(str(ENV_KEYS.accountsApiUrl, BRAND_DEFAULTS.accountsApiUrl)),
    accountsSignInUrl,
    accountsHost: hostOf(accountsSignInUrl) ?? appDomain,
    oauthClientId: str(ENV_KEYS.oauthClientId, BRAND_DEFAULTS.oauthClientId),
    apiBase: str(ENV_KEYS.apiBase, BRAND_DEFAULTS.apiBase),
    storePublicUrl: siteUrls.store,
    siteHosts,
    siteUrls,
  };
}

/** Hostname (lowercase, trailing dot hata kar) - production check ke liye. */
export function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

/** Yeh hostname hamare apne zone (appDomain) ka hai? Demo/preview gating isi se. */
export function isBrandHost(hostname: string, appDomain: string): boolean {
  const host = normalizeHost(hostname);
  const domain = appDomain.toLowerCase().replace(/^\.+/, '');
  return host === domain || host.endsWith(`.${domain}`);
}

/** Hostname se site mode - configured site hosts se match hota hai (koi hardcode prefix nahi). */
export function modeForHost(hostname: string, brand: Brand): SiteMode | null {
  const host = normalizeHost(hostname);
  for (const { id } of SITE_MODES) {
    if (brand.siteHosts[id] === host || hostOf(brand.siteUrls[id]) === host) return id;
  }
  return null;
}

// ── Copy / SEO (app name se derive hota hai, hardcode nahi) ─────────
export function seoFor(mode: SiteMode, brand: Brand): { title: string; description: string } {
  const { appName, shortName, ecosystemName } = brand;
  if (mode === 'console') {
    return {
      title: `${shortName} Developer Console`,
      description: `Publish Android apps to ${appName}. Manage app listings, APK releases, reviews, and developer account settings.`,
    };
  }
  if (mode === 'admin') {
    return {
      title: `${appName} Admin`,
      description: `Administrative tools for reviewing and managing apps published on ${appName}.`,
    };
  }
  if (mode === 'storeapp') {
    return {
      title: `${appName} App for Android`,
      description: `Download the official ${appName} app for Android and discover apps, games, and updates from the ${ecosystemName} ecosystem.`,
    };
  }
  return {
    title: `${appName} | Android Apps & Games`,
    description: `Discover and download Android apps and games on ${appName}. Browse trusted listings and reviews from the ${ecosystemName} ecosystem.`,
  };
}

export function manifestFor(brand: Brand) {
  return {
    name: brand.appName,
    short_name: brand.shortName,
    description: `Discover and download Android apps and games from the ${brand.ecosystemName} ecosystem.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#212121',
    theme_color: '#212121',
    icons: [
      { src: '/assets/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/assets/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/assets/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** index.html ke %TOKEN% - build (vite.config.ts) inhe brand se replace karta hai. */
export function htmlTokens(brand: Brand): Record<string, string> {
  const seo = seoFor('store', brand);
  return {
    APP_NAME: brand.appName,
    APP_SHORT_NAME: brand.shortName,
    STORE_URL: brand.siteUrls.store,
    ICON_URL: `${brand.siteUrls.store}/assets/icon-512.png`,
    SEO_TITLE: seo.title,
    SEO_DESCRIPTION: seo.description,
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderIndexHtml(html: string, brand: Brand): string {
  const tokens = htmlTokens(brand);
  return html.replace(/%([A-Z][A-Z0-9_]*)%/g, (match, key: string) =>
    key in tokens ? escapeHtml(tokens[key]) : match,
  );
}
