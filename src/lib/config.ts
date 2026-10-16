// ── Gothwad Store config ─────────────────────────────────────────────
// Domain kabhi code me hardcode nahi (Accounts Rule #1) - sab yahan / env se.
export const AUTH_BASE =
  import.meta.env.VITE_GOTHWAD_AUTH_URL ?? 'https://accounts.gothwadtech.com/api';
export const AUTH_SIGNIN_URL =
  import.meta.env.VITE_GOTHWAD_SIGNIN_URL ?? 'https://accounts.gothwadtech.com';
export const OAUTH_CLIENT_ID = import.meta.env.VITE_GOTHWAD_CLIENT_ID ?? 'gothwad-store';
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

/** Kaunsi site chal rahi hai - hostname se. Preview/local par ?mode= se switch. */
export type SiteMode = 'store' | 'console' | 'admin' | 'storeapp';

export function detectMode(): SiteMode {
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith('admin.console.')) return 'admin';
  if (host.startsWith('console.')) return 'console';
  if (host.startsWith('storeapp.')) return 'storeapp';
  if (host.startsWith('store.')) return 'store';
  // Local / Cloudflare preview (*.e2b.app, localhost) - query ya saved choice
  const q = new URLSearchParams(window.location.search).get('mode');
  if (q === 'store' || q === 'console' || q === 'admin' || q === 'storeapp') return q;
  const saved = localStorage.getItem('gothwad-site-mode');
  if (saved === 'store' || saved === 'console' || saved === 'admin' || saved === 'storeapp')
    return saved;
  return 'store';
}

export const SITE_URLS: Record<SiteMode, string> = {
  store: 'https://store.gothwadtech.com',
  console: 'https://console.gothwadtech.com',
  admin: 'https://admin.console.gothwadtech.com',
  storeapp: 'https://storeapp.gothwadtech.com',
};

export const SITE_MODES: { id: SiteMode; label: string }[] = [
  { id: 'store', label: 'Store' },
  { id: 'console', label: 'Console' },
  { id: 'admin', label: 'Admin' },
  { id: 'storeapp', label: 'Store App' },
];

export function isProductionHostCheck(): boolean {
  return window.location.hostname.endsWith('gothwadtech.com');
}
