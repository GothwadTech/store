import { useCallback, useEffect, useState } from 'react';

const AUTHUSER_PATH_RE = /^\/u\/([0-5])(?=\/|$)/;

export function getAuthuserFromLocation(): number | null {
  if (typeof window === 'undefined') return null;
  const pathMatch = window.location.pathname.match(AUTHUSER_PATH_RE);
  if (pathMatch) return Number(pathMatch[1]);
  const params = new URLSearchParams(window.location.search);
  const q = params.get('authuser') ?? params.get('u');
  if (q !== null && /^[0-5]$/.test(q.trim())) return Number(q.trim());
  return null;
}

export function stripAuthuserPrefix(pathname: string): string {
  const stripped = pathname.replace(AUTHUSER_PATH_RE, '');
  return stripped || '/';
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

/** Chhota path-router (4 shells + /u/0..5 multi-account URL prefix support) */
export function usePath(): [string, (to: string) => void] {
  const [path, setPath] = useState(() => stripAuthuserPrefix(window.location.pathname));
  useEffect(() => {
    const onPop = () => setPath(stripAuthuserPrefix(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to: string) => {
    const fullTarget = withAuthuserPrefix(to);
    window.history.pushState({}, '', fullTarget);
    setPath(stripAuthuserPrefix(to));
    window.scrollTo({ top: 0 });
  }, []);
  return [path, navigate];
}
