import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AccountSlotItem, AppRelease, Category, Developer, GothwadUser, ReportItem, StoreApp,
} from '../types';
import { CATEGORIES, SEED_APPS, SEED_REPORTS, SEED_REVIEWS, SEED_SUBMISSIONS } from '../data/seed';
import {
  DEMO_USER, bumpAuthGeneration, getActiveAuthuser, setActiveAuthuser, signOut as authSignOut,
} from './auth';
import { detectMode, isDemoModeAllowed } from './config';
import {
  adminApi, ApiError, authApi, clearInflightSessions, devApi, fetchCatalog,
  resolveSessionState, userApi, type CatalogStatus, type DeveloperResolutionStatus,
  type PermissionResolutionStatus,
} from './api';
import { createAppActions, emptyState, mergeById, seedReleases } from './appState';
import type { AppState, NewReleaseInput } from './appState';
import { withAuthuserPrefix } from './router';

export type { AppState, NewReleaseInput };
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';
export type SectionStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

const LS_KEY = 'kiwi-store-state-v1';
let memoryDemoUser: GothwadUser | null = null;

interface Ctx extends AppState {
  categories: Category[];
  user: GothwadUser | null;
  accounts: AccountSlotItem[];
  activeSlot: string | null;
  authuser: number;
  authReady: boolean;
  authStatus: AuthStatus;
  authError: string | null;
  permissionsStatus: PermissionResolutionStatus;
  developerStatus: DeveloperResolutionStatus;
  developerError: string | null;
  libraryStatus: SectionStatus;
  libraryError: string | null;
  adminStatus: SectionStatus;
  adminError: string | null;
  isAdmin: boolean;
  backendLive: boolean;
  catalogStatus: CatalogStatus | 'loading';
  demoModeAvailable: boolean;
  isDemoUser: boolean;
  isPreviewMode: boolean;
  signInDemo: () => void;
  setUser: (u: GothwadUser | null) => void;
  signOut: () => void;
  signOutSlot: (slotId: string) => Promise<void>;
  switchAccount: (target: { id?: string; authuser?: number }) => Promise<void>;
  retryAuth: () => Promise<void>;
  retryCatalog: () => Promise<void>;
  retryLibrary: () => Promise<void>;
  retryDeveloper: () => Promise<void>;
  retryAdmin: () => Promise<void>;
  toggleWishlist: (appId: string) => Promise<void>;
  recordDownload: (app: StoreApp) => Promise<void>;
  addReview: (appId: string, rating: number, body: string) => Promise<void>;
  replyReview: (reviewId: string, reply: string) => Promise<void>;
  registerDeveloper: (d: Omit<Developer, 'id' | 'userId' | 'username' | 'verified' | 'createdAt'>) => Promise<void>;
  createApp: (a: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>) => Promise<StoreApp>;
  updateApp: (id: string, patch: Partial<StoreApp>) => Promise<void>;
  addRelease: (appId: string, r: NewReleaseInput) => Promise<AppRelease>;
  submitForReview: (appId: string, releaseId: string) => Promise<void>;
  decideSubmission: (id: string, ok: boolean, note: string) => Promise<void>;
  setAppStatus: (id: string, status: StoreApp['status']) => Promise<void>;
  reportApp: (app: StoreApp, reason: string, details: string) => Promise<void>;
  resolveReport: (id: string, status: ReportItem['status']) => Promise<void>;
  liveReleaseOf: (appId: string) => AppRelease | undefined;
}

const AppContext = createContext<Ctx | null>(null);

function loadState(demoModeAvailable: boolean): AppState {
  if (!demoModeAvailable) return emptyState;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.apps) && parsed.apps.length) return parsed;
    }
  } catch { /* ignore */ }
  return {
    apps: SEED_APPS, releases: seedReleases, reviews: SEED_REVIEWS,
    submissions: SEED_SUBMISSIONS, reports: SEED_REPORTS, wishlist: [], library: [], developer: null,
  };
}

function loadDemoUser(demoModeAvailable: boolean): GothwadUser | null {
  if (!demoModeAvailable) return null;
  return memoryDemoUser;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const demoModeAvailable = isDemoModeAllowed();
  const [state, setState] = useState<AppState>(() => loadState(demoModeAvailable));
  const [categories, setCategories] = useState<Category[]>(() => (demoModeAvailable ? CATEGORIES : []));
  const [backendLive, setBackendLive] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | 'loading'>('loading');
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);
  const [permissionsStatus, setPermissionsStatus] = useState<PermissionResolutionStatus>('loading');
  const [developerStatus, setDeveloperStatus] = useState<DeveloperResolutionStatus>('loading');
  const [developerError, setDeveloperError] = useState<string | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<SectionStatus>('idle');
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<SectionStatus>('idle');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [user, setUserState] = useState<GothwadUser | null>(() => loadDemoUser(demoModeAvailable));
  const [accounts, setAccounts] = useState<AccountSlotItem[]>([]);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [authuser, setAuthuser] = useState<number>(() => getActiveAuthuser() ?? 0);
  const [authReady, setAuthReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authError, setAuthError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const liveRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const demoAllowedRef = useRef(demoModeAvailable);
  const authGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const isDemoUser = demoModeAvailable && !!user && user.id === DEMO_USER.id;
  const isDemoUserRef = useRef(isDemoUser);
  isDemoUserRef.current = isDemoUser;
  const isPreviewMode = demoModeAvailable && (isDemoUser || (!user && !backendLive));

  const apiMode = useCallback(() => liveRef.current && !!userRef.current && !isDemoUserRef.current, []);
  const isLocalDemo = useCallback(() => demoAllowedRef.current && userRef.current?.id === DEMO_USER.id, []);
  const assertCanWrite = useCallback(() => {
    if (apiMode() || isLocalDemo()) return;
    if (!userRef.current) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
    throw new ApiError(503, 'backend_unavailable', 'The Store service is unavailable. Please try again later.');
  }, [apiMode, isLocalDemo]);

  const patch = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);
  const clearPrivateState = useCallback(() => {
    patch((c) => ({
      ...c,
      apps: c.apps.filter((app) => app.status === 'published'),
      releases: c.releases.filter((release) => release.isLive),
      submissions: [], reports: [], wishlist: [], library: [], developer: null,
    }));
  }, [patch]);

  useEffect(() => {
    if (!demoModeAvailable) { try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }
  }, [demoModeAvailable]);

  useEffect(() => {
    if (!demoModeAvailable || (liveRef.current && !isDemoUser)) return;
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, demoModeAvailable, isDemoUser]);

  const hydrateCatalog = useCallback(async (gen = authGenRef.current) => {
    const catalog = await fetchCatalog();
    if (gen !== authGenRef.current) return;
    const isLive = catalog.status === 'ready';
    if (isLive) { liveRef.current = true; setBackendLive(true); }
    setCatalogStatus(catalog.status);
    if (isLive) setCategories(catalog.categories);
    else if (!demoModeAvailable || (userRef.current && userRef.current.id !== DEMO_USER.id)) setCategories([]);
    if (!isLive) return;
    setState((c) => ({
      ...c,
      apps: mergeById(isDemoUserRef.current ? c.apps : c.apps.filter((a) => a.status !== 'published'), catalog.apps),
      releases: mergeById(isDemoUserRef.current ? c.releases : c.releases.filter((r) => !r.isLive), catalog.releases),
      reviews: mergeById(c.reviews, catalog.reviews),
    }));
  }, [demoModeAvailable]);

  const hydrateLibrary = useCallback(async (gen = authGenRef.current, signal?: AbortSignal) => {
    if (!userRef.current || isDemoUserRef.current) return;
    setLibraryStatus('loading');
    setLibraryError(null);
    try {
      const [lib, wish] = await Promise.all([userApi.libraryIds(signal), userApi.wishlistIds(signal)]);
      if (gen !== authGenRef.current) return;
      liveRef.current = true;
      setBackendLive(true);
      patch((c) => ({ ...c, library: lib.appIds, wishlist: wish.appIds }));
      setLibraryStatus('ready');
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError' || gen !== authGenRef.current) return;
      setLibraryStatus('unavailable');
      setLibraryError(err instanceof Error ? err.message : 'Could not load your library and wishlist right now.');
    }
  }, [patch]);

  const hydrateDeveloper = useCallback(async (gen = authGenRef.current, signal?: AbortSignal) => {
    if (!userRef.current || isDemoUserRef.current) return;
    setDeveloperStatus('loading');
    setDeveloperError(null);
    try {
      const bundle = await devApi.bundle(signal);
      if (gen !== authGenRef.current) return;
      liveRef.current = true;
      setBackendLive(true);
      patch((c) => ({
        ...c, developer: bundle.developer,
        apps: mergeById(c.apps, bundle.apps),
        releases: mergeById(c.releases, bundle.releases),
        reviews: mergeById(c.reviews, bundle.reviews),
        submissions: bundle.submissions,
      }));
      setDeveloperStatus('ready');
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError' || gen !== authGenRef.current) return;
      if (err instanceof ApiError && err.status === 403 && err.code === 'developer_required') {
        liveRef.current = true;
        setBackendLive(true);
        patch((c) => ({ ...c, developer: null }));
        setDeveloperStatus('none');
        setDeveloperError(null);
        return;
      }
      setDeveloperStatus('unavailable');
      setDeveloperError(err instanceof Error ? err.message : 'Could not load your developer workspace right now.');
    }
  }, [patch]);

  const hydrateAdmin = useCallback(async (gen = authGenRef.current, signal?: AbortSignal) => {
    if (!userRef.current || isDemoUserRef.current) return;
    setAdminStatus('loading');
    setAdminError(null);
    try {
      const [adminApps, queue, reports] = await Promise.all([
        adminApi.apps(signal), adminApi.queue(signal), adminApi.reports(signal),
      ]);
      if (gen !== authGenRef.current) return;
      liveRef.current = true;
      setBackendLive(true);
      patch((c) => ({
        ...c,
        apps: mergeById(c.apps, adminApps.apps),
        releases: mergeById(c.releases, [...adminApps.releases, ...queue.releases]),
        submissions: mergeById(adminApps.submissions, queue.submissions),
        reports: reports.reports,
      }));
      setAdminStatus('ready');
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError' || gen !== authGenRef.current) return;
      if (err instanceof ApiError && err.status === 403) {
        setServerAdmin(false);
        setPermissionsStatus('ready');
        setAdminStatus('idle');
        return;
      }
      setAdminStatus('unavailable');
      setAdminError(err instanceof Error ? err.message : 'Could not load moderation data from the Store service.');
    }
  }, [patch]);

  const hydrateIdentity = useCallback(async (
    gen = authGenRef.current,
    opts?: { force?: boolean; signal?: AbortSignal },
  ) => {
    const mode = detectMode();
    const session = await resolveSessionState({
      light: mode !== 'console',
      force: opts?.force,
      signal: opts?.signal,
    });
    if (gen !== authGenRef.current) return;

    const realUser =
      session.status === 'authenticated' && session.user && session.user.id !== DEMO_USER.id
        ? session.user
        : null;
    if (session.d1Configured) { liveRef.current = true; setBackendLive(true); }

    if (realUser) {
      userRef.current = realUser;
      memoryDemoUser = null;
      setUserState(realUser);
      setAccounts(session.accounts);
      setActiveSlot(session.activeSlot);
      setAuthuser(session.authuser);
      setServerAdmin(session.isAdmin);
      setPermissionsStatus(session.permissionsStatus);
      setAuthStatus('authenticated');
      setAuthError(session.errorMessage ?? null);
      if (session.developer) patch((c) => ({ ...c, developer: session.developer }));
      setDeveloperStatus(session.developerStatus);
      setAuthReady(true);

      if (mode === 'store') {
        void hydrateLibrary(gen, opts?.signal);
      } else if (mode === 'console') {
        if (session.permissionsStatus === 'unavailable' || session.developerStatus === 'unavailable') {
          setDeveloperStatus('unavailable');
          setDeveloperError(session.errorMessage || 'Developer tools are unavailable until the Store service is connected.');
        } else if (session.developerStatus === 'none') {
          liveRef.current = true;
          setBackendLive(true);
          patch((c) => ({ ...c, developer: null }));
          setDeveloperStatus('none');
        } else {
          void hydrateDeveloper(gen, opts?.signal);
        }
      } else if (mode === 'admin' && session.permissionsStatus === 'ready' && session.isAdmin === true) {
        void hydrateAdmin(gen, opts?.signal);
      }
      return;
    }

    if (!isDemoUserRef.current) { userRef.current = null; setUserState(null); }
    setAccounts([]);
    setActiveSlot(null);
    if (session.status === 'unavailable') {
      setServerAdmin(null);
      setPermissionsStatus('unavailable');
      setDeveloperStatus('unavailable');
      setAuthStatus('unavailable');
      setAuthError(session.errorMessage || 'Could not verify your Gothwad Account right now. Please try again.');
    } else {
      setServerAdmin(false);
      setPermissionsStatus('ready');
      setDeveloperStatus('none');
      setAuthStatus('anonymous');
      setAuthError(null);
    }
    setAuthReady(true);
  }, [hydrateAdmin, hydrateDeveloper, hydrateLibrary, patch]);

  const hydrateFromBackend = useCallback(async (opts?: { force?: boolean }) => {
    const gen = authGenRef.current;
    await Promise.all([hydrateIdentity(gen, { force: opts?.force }), hydrateCatalog(gen)]);
  }, [hydrateCatalog, hydrateIdentity]);

  useEffect(() => {
    const gen = authGenRef.current;
    void hydrateIdentity(gen);
    void hydrateCatalog(gen);
  }, [hydrateCatalog, hydrateIdentity]);

  const setUser = useCallback((next: GothwadUser | null) => {
    if (!demoModeAvailable && next?.id === DEMO_USER.id) return;
    authGenRef.current = bumpAuthGeneration();
    clearInflightSessions();
    userRef.current = next;
    setUserState(next);
    setAuthStatus(next ? 'authenticated' : 'anonymous');
    setAuthError(null);
    setAuthReady(true);
    memoryDemoUser = demoModeAvailable && next?.id === DEMO_USER.id ? DEMO_USER : null;
  }, [demoModeAvailable]);

  const signInDemo = useCallback(() => { if (demoModeAvailable) setUser(DEMO_USER); }, [demoModeAvailable, setUser]);

  const signOut = useCallback(() => {
    const wasLocalDemo = isLocalDemo();
    abortRef.current?.abort();
    abortRef.current = null;
    authGenRef.current = bumpAuthGeneration();
    clearInflightSessions();
    void authSignOut();
    setServerAdmin(false);
    setPermissionsStatus('ready');
    setDeveloperStatus('none');
    setDeveloperError(null);
    setLibraryStatus('idle');
    setLibraryError(null);
    setAdminStatus('idle');
    setAdminError(null);
    setAccounts([]);
    setActiveSlot(null);
    userRef.current = null;
    memoryDemoUser = null;
    setUserState(null);
    setAuthStatus('anonymous');
    setAuthError(null);
    if (!wasLocalDemo) clearPrivateState();
  }, [clearPrivateState, isLocalDemo]);

  const signOutSlot = useCallback(async (slotId: string) => {
    const trimmed = typeof slotId === 'string' ? slotId.trim() : '';
    if (!trimmed) return;
    abortRef.current?.abort();
    authGenRef.current = bumpAuthGeneration();
    clearInflightSessions();
    await authSignOut(trimmed);
    clearPrivateState();
    await hydrateFromBackend({ force: true });
  }, [clearPrivateState, hydrateFromBackend]);

  const switchAccount = useCallback(async (target: { id?: string; authuser?: number }) => {
    const res = await authApi.switchAccount(target);
    if (res && res.ok === false) throw new ApiError(502, 'switch_failed', 'Could not switch accounts. Please try again.');
    abortRef.current?.abort();
    authGenRef.current = bumpAuthGeneration();
    clearInflightSessions();
    clearPrivateState();
    setServerAdmin(null);
    setPermissionsStatus('loading');
    setDeveloperStatus('loading');
    setDeveloperError(null);
    setLibraryStatus('idle');
    setLibraryError(null);
    setAdminStatus('idle');
    setAdminError(null);
    const nextAuthuser = typeof res?.authuser === 'number' ? res.authuser : target.authuser;
    if (typeof nextAuthuser === 'number') {
      setActiveAuthuser(nextAuthuser);
      setAuthuser(nextAuthuser);
      const nextPath = withAuthuserPrefix(window.location.pathname, nextAuthuser);
      window.history.replaceState({}, '', nextPath + window.location.search);
    }
    await hydrateFromBackend({ force: true });
  }, [clearPrivateState, hydrateFromBackend]);

  const retryAuth = useCallback(async () => {
    const gen = bumpAuthGeneration();
    authGenRef.current = gen;
    clearInflightSessions();
    setAuthStatus('loading');
    setAuthError(null);
    await hydrateIdentity(gen, { force: true });
  }, [hydrateIdentity]);

  const retryCatalog = useCallback(async () => {
    setCatalogStatus('loading');
    await hydrateCatalog(authGenRef.current);
  }, [hydrateCatalog]);

  const retryLibrary = useCallback(async () => { await hydrateLibrary(authGenRef.current); }, [hydrateLibrary]);
  const retryDeveloper = useCallback(async () => {
    if (permissionsStatus === 'unavailable') { await retryAuth(); return; }
    await hydrateDeveloper(authGenRef.current);
  }, [hydrateDeveloper, permissionsStatus, retryAuth]);
  const retryAdmin = useCallback(async () => {
    if (permissionsStatus !== 'ready' || !serverAdmin) { await retryAuth(); return; }
    await hydrateAdmin(authGenRef.current);
  }, [hydrateAdmin, permissionsStatus, retryAuth, serverAdmin]);

  const actions = useMemo(
    () =>
      createAppActions({
        getState: () => stateRef.current,
        getUser: () => userRef.current,
        apiMode,
        isLocalDemo,
        assertCanWrite,
        patch,
        setDeveloperStatus,
      }),
    [apiMode, assertCanWrite, isLocalDemo, patch],
  );

  const liveReleaseOf = useCallback(
    (appId: string) => state.releases.filter((r) => r.appId === appId && r.isLive).sort((a, b) => b.versionCode - a.versionCode)[0],
    [state.releases],
  );

  const value: Ctx = useMemo(
    () => ({
      ...state, categories, user, accounts, activeSlot, authuser, authReady, authStatus, authError,
      permissionsStatus, developerStatus, developerError, libraryStatus, libraryError, adminStatus, adminError,
      backendLive, catalogStatus, demoModeAvailable, isDemoUser, isPreviewMode,
      isAdmin: serverAdmin === true || (isDemoUser && user?.username === DEMO_USER.username),
      setUser, signInDemo, signOut, signOutSlot, switchAccount,
      retryAuth, retryCatalog, retryLibrary, retryDeveloper, retryAdmin,
      ...actions, liveReleaseOf,
    }),
    [
      state, categories, user, accounts, activeSlot, authuser, authReady, authStatus, authError,
      permissionsStatus, developerStatus, developerError, libraryStatus, libraryError, adminStatus, adminError,
      backendLive, catalogStatus, demoModeAvailable, isDemoUser, isPreviewMode, serverAdmin,
      setUser, signInDemo, signOut, signOutSlot, switchAccount,
      retryAuth, retryCatalog, retryLibrary, retryDeveloper, retryAdmin,
      actions, liveReleaseOf,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
