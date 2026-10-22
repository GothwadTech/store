import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AccountSlotItem, AppRelease, Category, Developer, GothwadUser, ReportItem, StoreApp,
} from '../types';
import { CATEGORIES, SEED_APPS, SEED_REPORTS, SEED_REVIEWS, SEED_SUBMISSIONS } from '../data/seed';
import { apkProviderForSize } from './storage';
import { DEMO_USER, setActiveAuthuser, signOut as authSignOut } from './auth';
import { isDemoModeAllowed } from './config';
import { adminApi, ApiError, authApi, devApi, fetchCatalog, fetchSession, userApi } from './api';
import type { CatalogStatus } from './api';
import {
  applyLocalDemoDecide, applyLocalDemoReview, applyLocalDemoSubmit,
  buildLocalDemoApp, buildLocalDemoRelease, emptyState, mergeById, seedReleases, uid,
} from './appState';
import type { AppState, NewReleaseInput } from './appState';
import { withAuthuserPrefix } from './router';

export type { AppState, NewReleaseInput };

const LS_KEY = 'kiwi-store-state-v1';
let memoryDemoUser: GothwadUser | null = null;

interface Ctx extends AppState {
  categories: Category[];
  user: GothwadUser | null;
  accounts: AccountSlotItem[];
  activeSlot: string | null;
  authuser: number;
  authReady: boolean;
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
  } catch { /* ignore unavailable or invalid local preview state */ }
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
  const [user, setUserState] = useState<GothwadUser | null>(() => loadDemoUser(demoModeAvailable));
  const [accounts, setAccounts] = useState<AccountSlotItem[]>([]);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [authuser, setAuthuser] = useState<number>(0);
  const [authReady, setAuthReady] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const liveRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const demoAllowedRef = useRef(demoModeAvailable);
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

  useEffect(() => {
    if (!demoModeAvailable) {
      try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    }
  }, [demoModeAvailable]);

  useEffect(() => {
    if (!demoModeAvailable || (liveRef.current && !isDemoUser)) return;
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, demoModeAvailable, isDemoUser]);

  const hydrateFromBackend = useCallback(async () => {
    const [session, catalog] = await Promise.all([fetchSession(), fetchCatalog()]);
    const realUser = session?.user && session.user.id !== DEMO_USER.id ? session.user : null;
    const isLive = catalog.status === 'ready';
    liveRef.current = isLive;
    setBackendLive(isLive);
    setCatalogStatus(catalog.status);
    if (isLive) setCategories(catalog.categories);
    else if (!demoModeAvailable || realUser) setCategories([]);

    if (realUser && session) {
      userRef.current = realUser;
      memoryDemoUser = null;
      setUserState(realUser);
      setAccounts(session.accounts);
      setActiveSlot(session.activeSlot);
      setAuthuser(session.authuser);
      setServerAdmin(session.isAdmin);
    } else {
      setServerAdmin(null);
      setAccounts([]);
      setActiveSlot(null);
    }

    const preserveLocalDemo = !realUser && isDemoUserRef.current;
    setState((current) => {
      const base = realUser ? { ...emptyState, developer: session?.developer ?? null } : current;
      if (!isLive) return base;
      if (preserveLocalDemo) {
        return {
          ...base,
          apps: mergeById(base.apps, catalog.apps),
          releases: mergeById(base.releases, catalog.releases),
          reviews: mergeById(base.reviews, catalog.reviews),
        };
      }
      return {
        ...base, apps: catalog.apps, releases: catalog.releases,
        reviews: catalog.reviews, submissions: [], reports: [],
      };
    });

    if (!isLive || !realUser) {
      setAuthReady(true);
      return;
    }

    try {
      const [library, wishlist] = await Promise.all([userApi.libraryIds(), userApi.wishlistIds()]);
      patch((current) => ({ ...current, library: library.appIds, wishlist: wishlist.appIds }));
    } catch { /* keep empty */ }

    if (session?.developer) {
      try {
        const bundle = await devApi.bundle();
        patch((current) => ({
          ...current, developer: bundle.developer,
          apps: mergeById(current.apps, bundle.apps),
          releases: mergeById(current.releases, bundle.releases),
          reviews: mergeById(current.reviews, bundle.reviews),
          submissions: bundle.submissions,
        }));
      } catch { /* ignore */ }
    }

    if (session?.isAdmin) {
      try {
        const [adminApps, queue, reports] = await Promise.all([adminApi.apps(), adminApi.queue(), adminApi.reports()]);
        patch((current) => ({
          ...current,
          apps: mergeById(current.apps, adminApps.apps),
          releases: mergeById(current.releases, [...adminApps.releases, ...queue.releases]),
          submissions: mergeById(adminApps.submissions, queue.submissions),
          reports: reports.reports,
        }));
      } catch { /* ignore */ }
    }
    setAuthReady(true);
  }, [demoModeAvailable, patch]);

  useEffect(() => { void hydrateFromBackend(); }, [hydrateFromBackend]);

  const setUser = useCallback((next: GothwadUser | null) => {
    if (!demoModeAvailable && next?.id === DEMO_USER.id) return;
    userRef.current = next;
    setUserState(next);
    memoryDemoUser = demoModeAvailable && next?.id === DEMO_USER.id ? DEMO_USER : null;
  }, [demoModeAvailable]);

  const signInDemo = useCallback(() => { if (demoModeAvailable) setUser(DEMO_USER); }, [demoModeAvailable, setUser]);

  const signOut = useCallback(() => {
    const wasLocalDemo = isLocalDemo();
    void authSignOut();
    setServerAdmin(null);
    setAccounts([]);
    setActiveSlot(null);
    setUser(null);
    if (!wasLocalDemo) {
      patch((current) => ({
        ...current,
        apps: current.apps.filter((app) => app.status === 'published'),
        releases: current.releases.filter((release) => release.isLive),
        submissions: [], reports: [], wishlist: [], library: [], developer: null,
      }));
    }
  }, [isLocalDemo, patch, setUser]);

  const signOutSlot = useCallback(async (slotId: string) => {
    const trimmed = typeof slotId === 'string' ? slotId.trim() : '';
    if (!trimmed) return;
    await authSignOut(trimmed);
    await hydrateFromBackend();
  }, [hydrateFromBackend]);

  const switchAccount = useCallback(async (target: { id?: string; authuser?: number }) => {
    try { await authApi.switchAccount(target); } catch { /* ignore if cross-origin cookie switch fallback */ }
    if (typeof target.authuser === 'number') {
      setActiveAuthuser(target.authuser);
      setAuthuser(target.authuser);
      const nextPath = withAuthuserPrefix(window.location.pathname, target.authuser);
      window.history.replaceState({}, '', nextPath + window.location.search);
    }
    await hydrateFromBackend();
  }, [hydrateFromBackend]);

  const toggleWishlist = useCallback(async (appId: string) => {
    assertCanWrite();
    const wished = stateRef.current.wishlist.includes(appId);
    if (apiMode()) await userApi.setWishlist(appId, !wished);
    patch((current) => ({
      ...current,
      wishlist: wished ? current.wishlist.filter((id) => id !== appId) : [...current.wishlist, appId],
    }));
  }, [assertCanWrite, patch, apiMode]);

  const recordDownload = useCallback(async (app: StoreApp) => {
    if (!isLocalDemo()) return;
    patch((current) => ({
      ...current,
      apps: current.apps.map((item) => (item.id === app.id ? { ...item, downloadsCount: item.downloadsCount + 1 } : item)),
      library: current.library.includes(app.id) ? current.library : [...current.library, app.id],
    }));
  }, [isLocalDemo, patch]);

  const addReview = useCallback(async (appId: string, rating: number, body: string) => {
    assertCanWrite();
    const currentUser = userRef.current;
    if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
    if (apiMode()) {
      const { review } = await userApi.addReview(appId, rating, body);
      patch((current) => {
        const reviews = [...current.reviews.filter((item) => !(item.appId === appId && item.userId === currentUser.id)), review];
        const forApp = reviews.filter((item) => item.appId === appId);
        const average = forApp.reduce((total, item) => total + item.rating, 0) / Math.max(1, forApp.length);
        return {
          ...current, reviews,
          apps: current.apps.map((app) => (app.id === appId ? { ...app, ratingAvg: Math.round(average * 10) / 10, ratingCount: forApp.length } : app)),
        };
      });
      return;
    }
    patch((current) => applyLocalDemoReview(current, appId, currentUser, rating, body));
  }, [assertCanWrite, patch, apiMode]);

  const replyReview = useCallback(async (reviewId: string, reply: string) => {
    assertCanWrite();
    if (apiMode()) {
      const review = stateRef.current.reviews.find((item) => item.id === reviewId);
      if (!review) return;
      const { review: saved } = await devApi.reply(review.appId, reviewId, reply);
      patch((current) => ({ ...current, reviews: current.reviews.map((item) => (item.id === reviewId ? saved : item)) }));
      return;
    }
    patch((current) => ({
      ...current,
      reviews: current.reviews.map((item) =>
        item.id === reviewId ? { ...item, developerReply: reply, developerReplyAt: new Date().toISOString() } : item,
      ),
    }));
  }, [assertCanWrite, patch, apiMode]);

  const registerDeveloper = useCallback(async (data: Omit<Developer, 'id' | 'userId' | 'username' | 'verified' | 'createdAt'>) => {
    assertCanWrite();
    const currentUser = userRef.current;
    if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
    if (apiMode()) {
      const { developer } = await devApi.register(data);
      patch((current) => ({ ...current, developer }));
      return;
    }
    patch((current) => ({
      ...current,
      developer: { ...data, id: 'dev-' + currentUser.username, userId: currentUser.id, username: currentUser.username, verified: false, createdAt: new Date().toISOString() },
    }));
  }, [assertCanWrite, patch, apiMode]);

  const createApp = useCallback(async (data: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>): Promise<StoreApp> => {
    assertCanWrite();
    if (apiMode()) {
      const { app } = await devApi.createApp(data);
      patch((current) => ({ ...current, apps: [app, ...current.apps.filter((item) => item.id !== app.id)] }));
      return app;
    }
    const created = buildLocalDemoApp(stateRef.current, userRef.current, data);
    patch((current) => ({ ...current, apps: [created, ...current.apps] }));
    return created;
  }, [assertCanWrite, patch, apiMode]);

  const updateApp = useCallback(async (id: string, changes: Partial<StoreApp>) => {
    assertCanWrite();
    if (apiMode()) {
      const { app } = await devApi.updateApp(id, changes);
      patch((current) => ({ ...current, apps: current.apps.map((item) => (item.id === id ? app : item)) }));
      return;
    }
    patch((current) => ({
      ...current,
      apps: current.apps.map((item) => (item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item)),
    }));
  }, [assertCanWrite, patch, apiMode]);

  const addRelease = useCallback(async (appId: string, releaseInput: NewReleaseInput): Promise<AppRelease> => {
    assertCanWrite();
    if (apiMode()) {
      const { release } = await devApi.createRelease(appId, {
        versionName: releaseInput.versionName,
        versionCode: releaseInput.versionCode,
        changelog: releaseInput.changelog,
        permissions: releaseInput.manifest?.permissions?.length ? releaseInput.manifest.permissions : releaseInput.permissions,
        manifest: releaseInput.manifest ?? undefined,
        apk: {
          provider: releaseInput.apkProvider ?? apkProviderForSize(releaseInput.sizeBytes),
          url: releaseInput.apkUrl ?? '',
          key: releaseInput.apkKey ?? releaseInput.apkName,
          sizeBytes: releaseInput.sizeBytes,
          sha256: releaseInput.apkSha256,
        },
      });
      patch((current) => ({ ...current, releases: [release, ...current.releases.filter((item) => item.id !== release.id)] }));
      return release;
    }
    const release = buildLocalDemoRelease(appId, releaseInput);
    patch((current) => ({ ...current, releases: [release, ...current.releases] }));
    return release;
  }, [assertCanWrite, patch, apiMode]);

  const submitForReview = useCallback(async (appId: string, releaseId: string) => {
    assertCanWrite();
    if (apiMode()) {
      const { submission } = await devApi.submit(appId, releaseId);
      patch((current) => ({
        ...current,
        submissions: [submission, ...current.submissions.filter((item) => item.id !== submission.id)],
        apps: current.apps.map((app) => (app.id === appId && app.status !== 'published' ? { ...app, status: 'in_review' } : app)),
      }));
      return;
    }
    patch((current) => applyLocalDemoSubmit(current, appId, releaseId));
  }, [assertCanWrite, patch, apiMode]);

  const decideSubmission = useCallback(async (id: string, approved: boolean, note: string) => {
    assertCanWrite();
    if (apiMode()) {
      const { submission } = await adminApi.decide(id, approved, note);
      try {
        const [adminApps, queue] = await Promise.all([adminApi.apps(), adminApi.queue()]);
        patch((current) => ({
          ...current,
          apps: mergeById(current.apps.filter((app) => !adminApps.apps.some((item) => item.id === app.id)), adminApps.apps),
          releases: mergeById(current.releases, [...adminApps.releases, ...queue.releases]),
          submissions: mergeById([submission], [...adminApps.submissions, ...queue.submissions].filter((item) => item.id !== submission.id)),
        }));
      } catch {
        patch((current) => ({ ...current, submissions: current.submissions.map((item) => (item.id === id ? submission : item)) }));
      }
      return;
    }
    patch((current) => applyLocalDemoDecide(current, id, approved, note, userRef.current?.username));
  }, [assertCanWrite, patch, apiMode]);

  const setAppStatus = useCallback(async (id: string, status: StoreApp['status']) => {
    assertCanWrite();
    if (apiMode()) {
      const app = stateRef.current.apps.find((item) => item.id === id);
      const mine = !!app && !!stateRef.current.developer && app.developerId === stateRef.current.developer.id;
      let saved: StoreApp | null = null;
      if (status === 'suspended') saved = (await adminApi.suspend(id)).app;
      else if (status === 'published' && (!mine || app?.status === 'suspended')) saved = (await adminApi.restore(id)).app;
      else if (status === 'published' || status === 'unlisted') saved = (await devApi.setStatus(id, status)).app;
      if (saved) patch((current) => ({ ...current, apps: current.apps.map((item) => (item.id === id ? saved! : item)) }));
      return;
    }
    patch((current) => ({ ...current, apps: current.apps.map((item) => (item.id === id ? { ...item, status } : item)) }));
  }, [assertCanWrite, patch, apiMode]);

  const reportApp = useCallback(async (app: StoreApp, reason: string, details: string) => {
    assertCanWrite();
    const currentUser = userRef.current;
    if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
    if (apiMode()) {
      const { report } = await userApi.report(app.id, reason, details);
      if (report) patch((current) => ({ ...current, reports: [report, ...current.reports] }));
      return;
    }
    patch((current) => ({
      ...current,
      reports: [{ id: 'rep-' + uid(), appId: app.id, appName: app.name, reporter: currentUser.username, reason, details, status: 'open', createdAt: new Date().toISOString() }, ...current.reports],
    }));
  }, [assertCanWrite, patch, apiMode]);

  const resolveReport = useCallback(async (id: string, status: ReportItem['status']) => {
    assertCanWrite();
    if (apiMode() && (status === 'resolved' || status === 'dismissed')) {
      const { report } = await adminApi.resolveReport(id, status);
      patch((current) => ({ ...current, reports: current.reports.map((item) => (item.id === id ? report : item)) }));
      return;
    }
    patch((current) => ({ ...current, reports: current.reports.map((item) => (item.id === id ? { ...item, status } : item)) }));
  }, [assertCanWrite, patch, apiMode]);

  const liveReleaseOf = useCallback(
    (appId: string) => state.releases.filter((release) => release.appId === appId && release.isLive).sort((a, b) => b.versionCode - a.versionCode)[0],
    [state.releases],
  );

  const value: Ctx = useMemo(
    () => ({
      ...state, categories, user, accounts, activeSlot, authuser, authReady, backendLive, catalogStatus,
      demoModeAvailable, isDemoUser, isPreviewMode,
      isAdmin: serverAdmin ?? (isDemoUser && user?.username === DEMO_USER.username),
      setUser, signInDemo, signOut, signOutSlot, switchAccount, toggleWishlist, recordDownload,
      addReview, replyReview, registerDeveloper, createApp, updateApp, addRelease,
      submitForReview, decideSubmission, setAppStatus, reportApp, resolveReport, liveReleaseOf,
    }),
    [
      state, categories, user, accounts, activeSlot, authuser, authReady, backendLive, catalogStatus,
      demoModeAvailable, isDemoUser, isPreviewMode, serverAdmin, setUser, signInDemo, signOut,
      signOutSlot, switchAccount, toggleWishlist, recordDownload, addReview, replyReview,
      registerDeveloper, createApp, updateApp, addRelease, submitForReview, decideSubmission,
      setAppStatus, reportApp, resolveReport, liveReleaseOf,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
