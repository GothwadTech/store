// ── Kiwi Store config ────────────────────────────────────────────────
// App name aur domains KABHI yahan (ya kisi component me) hardcode nahi karte
// (Accounts Rule #1). Single source of truth = shared/brand.ts, override = env.
//   Frontend : .env / Pages env vars   -> VITE_APP_NAME, VITE_APP_DOMAIN,
//              VITE_STORE_URL, VITE_CONSOLE_URL, VITE_ADMIN_URL, VITE_STOREAPP_URL
//   Worker   : dashboard vars / wrangler.toml -> APP_NAME, APP_DOMAIN, *_HOST
import {
  SITE_MODES,
  isBrandHost,
  modeForHost,
  normalizeHost,
  resolveBrand,
  seoFor,
} from '../../shared/brand';
import type { SiteMode } from '../../shared/brand';

export type { SiteMode };
export { SITE_MODES, seoFor };

/** Env (VITE_*) + defaults shared/brand.ts se - yahi object poori app use karti hai. */
export const BRAND = resolveBrand(import.meta.env as Record<string, unknown>);

export const APP_NAME = BRAND.appName;
export const APP_SHORT_NAME = BRAND.shortName;
export const ECOSYSTEM_NAME = BRAND.ecosystemName;
export const ACCOUNTS_NAME = BRAND.accountsName;
export const ACCOUNTS_HOST = BRAND.accountsHost;
export const STOREAPP_PACKAGE = BRAND.storeappPackage;
export const STORE_PUBLIC_URL = BRAND.storePublicUrl;

export const AUTH_BASE = BRAND.accountsApiUrl;
export const AUTH_SIGNIN_URL = BRAND.accountsSignInUrl;
export const OAUTH_CLIENT_ID = BRAND.oauthClientId;
export const API_BASE = BRAND.apiBase;

export const SITE_URLS: Record<SiteMode, string> = BRAND.siteUrls;
export const SITE_HOSTS: Record<SiteMode, string> = BRAND.siteHosts;

export const SITE_MODE_STORAGE_KEY = 'kiwi-site-mode';

function isSiteMode(value: string | null): value is SiteMode {
  return SITE_MODES.some((m) => m.id === value);
}

/** Kaunsi site chal rahi hai - configured site hosts se. Preview/local par ?mode= ya ?surface= se switch. */
export function detectMode(): SiteMode {
  const host = normalizeHost(window.location.hostname);
  const fromHost = modeForHost(host, BRAND);
  if (fromHost) return fromHost;
  // Never consult local preview settings on a production hostname.
  if (isBrandHost(host, BRAND.appDomain)) return 'store';
  // Local / Cloudflare preview (*.e2b.app, localhost) - query ya saved choice
  const params = new URLSearchParams(window.location.search);
  const q = params.get('mode') ?? params.get('surface');
  if (q === 'app') return 'storeapp';
  if (isSiteMode(q)) return q;
  try {
    const saved = localStorage.getItem(SITE_MODE_STORAGE_KEY);
    if (isSiteMode(saved)) return saved;
  } catch { /* Storage may be disabled in the browser. */ }
  return 'store';
}

export function isProductionHostCheck(): boolean {
  return isBrandHost(window.location.hostname, BRAND.appDomain);
}

/** Demo state/actions are permitted only on localhost and non-production previews. */
export function isDemoModeAllowed(): boolean {
  return !isProductionHostCheck();
}
