import { useCallback, useEffect, useState } from 'react';
import {
  getAuthuserFromLocation,
  parsePath,
  resolveSignOutSlotId,
  stripAuthuserPrefix,
  withAuthuserPrefix,
} from './authuser';

export {
  getAuthuserFromLocation,
  parsePath,
  resolveSignOutSlotId,
  stripAuthuserPrefix,
  withAuthuserPrefix,
};

/** Lightweight path router across all 4 surfaces with /u/0..5 multi-account URL prefix support. */
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
