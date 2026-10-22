// Pure URL / multi-account slot helpers (zero React or DOM framework dependencies)

const AUTHUSER_PATH_RE = /^\/u\/([0-5])(?=\/|$)/;

export function getAuthuserFromLocation(loc?: { pathname?: string; search?: string } | null): number | null {
  const target =
    loc ?? (typeof window !== 'undefined' && window.location ? window.location : null);
  if (!target) return null;
  const pathname = String(target.pathname ?? '');
  const pathMatch = pathname.match(AUTHUSER_PATH_RE);
  if (pathMatch) return Number(pathMatch[1]);
  const params = new URLSearchParams(String(target.search ?? ''));
  const q = params.get('authuser') ?? params.get('u');
  if (q !== null && /^[0-5]$/.test(q.trim())) return Number(q.trim());
  return null;
}

export function stripAuthuserPrefix(pathname: string): string {
  const stripped = String(pathname || '/').replace(AUTHUSER_PATH_RE, '');
  return stripped || '/';
}

export function parsePath(pathname: string): { authuser: number | null; path: string } {
  const match = String(pathname || '/').match(AUTHUSER_PATH_RE);
  return {
    authuser: match ? Number(match[1]) : null,
    path: stripAuthuserPrefix(pathname),
  };
}

export function withAuthuserPrefix(to: string, explicitIndex?: number | null): string {
  const clean = stripAuthuserPrefix(to.startsWith('/') ? to : `/${to}`);
  const idx =
    explicitIndex !== undefined
      ? explicitIndex
      : typeof window !== 'undefined' && AUTHUSER_PATH_RE.test(window.location.pathname)
        ? Number(window.location.pathname.match(AUTHUSER_PATH_RE)![1])
        : null;
  if (idx === null || idx < 0 || idx > 5) return clean;
  return clean === '/' ? `/u/${idx}` : `/u/${idx}${clean}`;
}

/**
 * Safely extract a slot ID whether `onSignOutAccount` is invoked as
 * `onSignOutAccount(slotId, targetAccount)` (remote GothwadAccountMenu contract)
 * or `onSignOutAccount(targetAccount)`. Never returns an empty string.
 */
export function resolveSignOutSlotId(
  slotOrAccount: string | { id?: string; slot?: string } | null | undefined,
  targetAccount?: { id?: string; slot?: string } | null,
): string | null {
  if (typeof slotOrAccount === 'string') {
    const trimmed = slotOrAccount.trim();
    if (trimmed) return trimmed;
  } else if (slotOrAccount && typeof slotOrAccount === 'object') {
    const candidate = String(slotOrAccount.id ?? slotOrAccount.slot ?? '').trim();
    if (candidate) return candidate;
  }
  if (targetAccount && typeof targetAccount === 'object') {
    const fallback = String(targetAccount.id ?? targetAccount.slot ?? '').trim();
    if (fallback) return fallback;
  }
  return null;
}
