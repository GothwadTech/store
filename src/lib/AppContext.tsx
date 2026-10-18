import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppRelease, Category, Developer, GothwadUser, ReportItem, Review, StoreApp, Submission } from '../types';
import { CATEGORIES, SEED_APPS, SEED_REPORTS, SEED_REVIEWS, SEED_SUBMISSIONS } from '../data/seed';
import { apkProviderForSize } from './storage';
import { DEMO_USER, signOut as authSignOut } from './auth';
import { isDemoModeAllowed } from './config';
import { adminApi, ApiError, devApi, fetchCatalog, fetchSession, userApi } from './api';
import type { ApkManifestInfo, CatalogStatus } from './api';

const LS_KEY = 'kiwi-store-state-v1';
const DEMO_USER_KEY = 'kiwi-demo-user';

interface AppState {
  apps: StoreApp[];
  releases: AppRelease[];
  reviews: Review[];
  submissions: Submission[];
  reports: ReportItem[];
  wishlist: string[];
  library: string[];
  developer: Developer | null;
}

export interface NewReleaseInput {
  versionName: string;
  versionCode: number;
  sizeBytes: number;
  changelog: string;
  permissions: string[];
  apkName: string;
  apkUrl?: string;
  apkProvider?: 'github';
  apkKey?: string;
  apkSha256?: string;
  manifest?: ApkManifestInfo | null;
}

interface Ctx extends AppState {
  categories: Category[];
  user: GothwadUser | null;
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
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const emptyState: AppState = {
  apps: [], releases: [], reviews: [], submissions: [], reports: [],
  wishlist: [], library: [], developer: null,
};

const seedReleases: AppRelease[] = SEED_APPS.map((app, index) => ({
  id: `rel-seed-${app.id}`,
  appId: app.id,
  versionCode: 10 + index,
  versionName: `1.${index}.0`,
  apkProvider: 'github',
  apkKey: `${app.packageName}/${app.packageName}-10${index}.apk`,
  // Sample listings have no real APK behind these records.
  apkUrl: '',
  apkSizeBytes: (14 + (index % 12)) * 1024 * 1024,
  minSdk: 24,
  permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
  changelog: 'Performance improvements and bug fixes.',
  reviewStatus: 'approved',
  isLive: true,
  createdAt: new Date().toISOString(),
  downloads: Math.round(app.downloadsCount * 0.7),
}));

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
    submissions: SEED_SUBMISSIONS, reports: SEED_REPORTS,
    wishlist: [], library: [], developer: null,
  };
}

function loadDemoUser(demoModeAvailable: boolean): GothwadUser | null {
  if (!demoModeAvailable) return null;
  try {
    const raw = window.sessionStorage.getItem(DEMO_USER_KEY);
    const saved = raw ? JSON.parse(raw) as GothwadUser : null;
    return saved?.id === DEMO_USER.id ? DEMO_USER : null;
  } catch { return null; }
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const map = new Map(base.map((item) => [item.id, item]));
  for (const item of extra) map.set(item.id, item);
  return [...map.values()];
}

export function AppProvider({ children }: { children: ReactNode }) {
  // This check is synchronous: production renders empty state on its very first
  // render, before any API request or hydration can complete.
  const demoModeAvailable = isDemoModeAllowed();
  const [state, setState] = useState<AppState>(() => loadState(demoModeAvailable));
  const [categories, setCategories] = useState<Category[]>(() => demoModeAvailable ? CATEGORIES : []);
  const [backendLive, setBackendLive] = useState(false);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | 'loading'>('loading');
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);
  const [user, setUserState] = useState<GothwadUser | null>(() => loadDemoUser(demoModeAvailable));
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
    if (!userRef.current) throw new ApiError(401, 'unauthorized', 'Please sign in with Gothwad to continue.');
    throw new ApiError(503, 'backend_unavailable', 'The Store service is unavailable. Please try again later.');
  }, [apiMode, isLocalDemo]);

  const patch = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  useEffect(() => {
    // Remove any legacy preview data left on production origins. The initial
    // production state is already empty, so this cleanup cannot cause a flash.
    if (!demoModeAvailable) {
      try {
        window.localStorage.removeItem(LS_KEY);
        window.sessionStorage.removeItem(DEMO_USER_KEY);
      } catch { /* Storage may be disabled by the browser. */ }
    }
  }, [demoModeAvailable]);

  useEffect(() => {
    if (!demoModeAvailable || (liveRef.current && !isDemoUser)) return;
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, demoModeAvailable, isDemoUser]);

  // ── Boot hydration: session → public catalog → developer/admin bundles ──
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [session, catalog] = await Promise.all([fetchSession(), fetchCatalog()]);
      if (cancelled) return;

      const realUser = session?.user && session.user.id !== DEMO_USER.id ? session.user : null;
      const isLive = catalog.status === 'ready';
      liveRef.current = isLive;
      setBackendLive(isLive);
      setCatalogStatus(catalog.status);
      if (isLive) setCategories(catalog.categories);
      else if (!demoModeAvailable || realUser) setCategories([]);

      if (realUser) {
        userRef.current = realUser;
        setUserState(realUser);
        try { window.sessionStorage.removeItem(DEMO_USER_KEY); } catch { /* Storage may be disabled. */ }
        setServerAdmin(session?.isAdmin ?? false);
      } else {
        setServerAdmin(null);
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
        return { ...base, apps: catalog.apps, releases: catalog.releases, reviews: catalog.reviews, submissions: [], reports: [] };
      });

      if (!isLive || !realUser) {
        if (!cancelled) setAuthReady(true);
        return;
      }

      try {
        const [library, wishlist] = await Promise.all([userApi.libraryIds(), userApi.wishlistIds()]);
        if (!cancelled) patch((current) => ({ ...current, library: library.appIds, wishlist: wishlist.appIds }));
      } catch { /* Private lists stay empty until the API is available. */ }

      if (session?.developer) {
        try {
          const bundle = await devApi.bundle();
          if (!cancelled) patch((current) => ({
            ...current,
            developer: bundle.developer,
            apps: mergeById(current.apps, bundle.apps),
            releases: mergeById(current.releases, bundle.releases),
            reviews: mergeById(current.reviews, bundle.reviews),
            submissions: bundle.submissions,
          }));
        } catch { /* The public catalog remains usable if the developer bundle fails. */ }
      }

      if (session?.isAdmin) {
        try {
          const [adminApps, queue, reports] = await Promise.all([adminApi.apps(), adminApi.queue(), adminApi.reports()]);
          if (!cancelled) patch((current) => ({
            ...current,
            apps: mergeById(current.apps, adminApps.apps),
            releases: mergeById(current.releases, [...adminApps.releases, ...queue.releases]),
            submissions: mergeById(adminApps.submissions, queue.submissions),
            reports: reports.reports,
          }));
        } catch { /* Admin data is never replaced with local placeholder records. */ }
      }
      if (!cancelled) setAuthReady(true);
    })();
    return () => { cancelled = true; };
  }, [demoModeAvailable, patch]);

  const setUser = useCallback((next: GothwadUser | null) => {
    if (!demoModeAvailable && next?.id === DEMO_USER.id) return;
    userRef.current = next;
    setUserState(next);
    try {
      if (demoModeAvailable && next?.id === DEMO_USER.id) window.sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(DEMO_USER));
      else window.sessionStorage.removeItem(DEMO_USER_KEY);
    } catch { /* Storage may be disabled by the browser. */ }
  }, [demoModeAvailable]);

  const signInDemo = useCallback(() => {
    if (demoModeAvailable) setUser(DEMO_USER);
  }, [demoModeAvailable, setUser]);

  const signOut = useCallback(() => {
    const wasLocalDemo = isLocalDemo();
    void authSignOut();
    setServerAdmin(null);
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

  const toggleWishlist = useCallback(async (appId: string) => {
    assertCanWrite();
    const wished = stateRef.current.wishlist.includes(appId);
    if (apiMode()) await userApi.setWishlist(appId, !wished);
    patch((current) => ({ ...current, wishlist: wished ? current.wishlist.filter((id) => id !== appId) : [...current.wishlist, appId] }));
  }, [assertCanWrite, patch, apiMode]);

  const recordDownload = useCallback(async (app: StoreApp) => {
    if (!isLocalDemo()) return; // Real downloads are counted by the Worker's redirect endpoint.
    patch((current) => ({
      ...current,
      apps: current.apps.map((item) => item.id === app.id ? { ...item, downloadsCount: item.downloadsCount + 1 } : item),
      library: current.library.includes(app.id) ? current.library : [...current.library, app.id],
    }));
  }, [isLocalDemo, patch]);

  const addReview = useCallback(async (appId: string, rating: number, body: string) => {
    assertCanWrite();
    const currentUser = userRef.current;
    if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in with Gothwad to continue.');
    if (apiMode()) {
      const { review } = await userApi.addReview(appId, rating, body);
      patch((current) => {
        const reviews = [...current.reviews.filter((item) => !(item.appId === appId && item.userId === currentUser.id)), review];
        const forApp = reviews.filter((item) => item.appId === appId);
        const average = forApp.reduce((total, item) => total + item.rating, 0) / Math.max(1, forApp.length);
        return {
          ...current,
          reviews,
          apps: current.apps.map((app) => app.id === appId ? { ...app, ratingAvg: Math.round(average * 10) / 10, ratingCount: forApp.length } : app),
        };
      });
      return;
    }
    patch((current) => {
      const mine = current.reviews.filter((item) => !(item.appId === appId && item.userId === currentUser.id));
      const reviews = [...mine, { id: uid(), appId, userId: currentUser.id, username: currentUser.username, rating, body, createdAt: new Date().toISOString() }];
      const forApp = reviews.filter((item) => item.appId === appId);
      const average = forApp.reduce((total, item) => total + item.rating, 0) / Math.max(1, forApp.length);
      const base = current.apps.find((app) => app.id === appId);
      const apps = current.apps.map((app) => app.id === appId
        ? { ...app, ratingAvg: Math.round((average + (base?.ratingAvg ?? average)) / 2 * 10) / 10, ratingCount: app.ratingCount + 1 }
        : app);
      return { ...current, reviews, apps };
    });
  }, [assertCanWrite, patch, apiMode]);

  const replyReview = useCallback(async (reviewId: string, reply: string) => {
    assertCanWrite();
    if (apiMode()) {
      const review = stateRef.current.reviews.find((item) => item.id === reviewId);
      if (!review) return;
      const { review: saved } = await devApi.reply(review.appId, reviewId, reply);
      patch((current) => ({ ...current, reviews: current.reviews.map((item) => item.id === reviewId ? saved : item) }));
      return;
    }
    patch((current) => ({ ...current, reviews: current.reviews.map((item) => item.id === reviewId ? { ...item, developerReply: reply, developerReplyAt: new Date().toISOString() } : item) }));
  }, [assertCanWrite, patch, apiMode]);

  const registerDeveloper = useCallback(async (data: Omit<Developer, 'id' | 'userId' | 'username' | 'verified' | 'createdAt'>) => {
    assertCanWrite();
    const currentUser = userRef.current;
    if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in with Gothwad to continue.');
    if (apiMode()) {
      const { developer } = await devApi.register(data);
      patch((current) => ({ ...current, developer }));
      return;
    }
    patch((current) => ({ ...current, developer: { ...data, id: 'dev-' + currentUser.username, userId: currentUser.id, username: currentUser.username, verified: false, createdAt: new Date().toISOString() } }));
  }, [assertCanWrite, patch, apiMode]);

  const createApp = useCallback(async (data: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>): Promise<StoreApp> => {
    assertCanWrite();
    if (apiMode()) {
      const { app } = await devApi.createApp(data);
      patch((current) => ({ ...current, apps: [app, ...current.apps.filter((item) => item.id !== app.id)] }));
      return app;
    }
    const currentUser = userRef.current;
    const created: StoreApp = {
      id: 'app-' + uid(), ...data,
      developerId: stateRef.current.developer?.id ?? 'dev-' + (currentUser?.username ?? 'preview'),
      developerName: stateRef.current.developer?.orgName ?? stateRef.current.developer?.displayName ?? currentUser?.name ?? 'Developer',
      status: 'draft', shortDesc: '', fullDesc: '',
      iconUrl: '', iconColor: '#2563eb', screenshots: [], tags: [],
      supportEmail: stateRef.current.developer?.supportEmail ?? currentUser?.email ?? '',
      ratingAvg: 0, ratingCount: 0, downloadsCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    patch((current) => ({ ...current, apps: [created, ...current.apps] }));
    return created;
  }, [assertCanWrite, patch, apiMode]);

  const updateApp = useCallback(async (id: string, changes: Partial<StoreApp>) => {
    assertCanWrite();
    if (apiMode()) {
      const { app } = await devApi.updateApp(id, changes);
      patch((current) => ({ ...current, apps: current.apps.map((item) => item.id === id ? app : item) }));
      return;
    }
    patch((current) => ({ ...current, apps: current.apps.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) }));
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
    const release: AppRelease = {
      id: 'rel-' + uid(), appId,
      versionName: releaseInput.versionName, versionCode: releaseInput.versionCode,
      apkProvider: releaseInput.apkProvider ?? apkProviderForSize(releaseInput.sizeBytes),
      apkKey: releaseInput.apkKey ?? releaseInput.apkName,
      apkUrl: releaseInput.apkUrl ?? '',
      apkSizeBytes: releaseInput.sizeBytes,
      apkSha256: releaseInput.apkSha256,
      minSdk: releaseInput.manifest?.minSdk ?? undefined,
      permissions: releaseInput.manifest?.permissions?.length ? releaseInput.manifest.permissions : releaseInput.permissions,
      changelog: releaseInput.changelog,
      reviewStatus: 'pending', isLive: false,
      createdAt: new Date().toISOString(), downloads: 0,
    };
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
        apps: current.apps.map((app) => app.id === appId && app.status !== 'published' ? { ...app, status: 'in_review' } : app),
      }));
      return;
    }
    patch((current) => {
      const app = current.apps.find((item) => item.id === appId);
      const release = current.releases.find((item) => item.id === releaseId);
      if (!app || !release) return current;
      return {
        ...current,
        apps: current.apps.map((item) => item.id === appId ? { ...item, status: 'in_review' } : item),
        submissions: [{
          id: 'sub-' + uid(), appId, appName: app.name, packageName: app.packageName,
          developerName: app.developerName, releaseId, versionName: release.versionName,
          versionCode: release.versionCode, apkProvider: release.apkProvider, apkSizeBytes: release.apkSizeBytes,
          status: 'pending', submittedAt: new Date().toISOString(),
        }, ...current.submissions],
      };
    });
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
        patch((current) => ({ ...current, submissions: current.submissions.map((item) => item.id === id ? submission : item) }));
      }
      return;
    }
    patch((current) => {
      const submission = current.submissions.find((item) => item.id === id);
      if (!submission) return current;
      return {
        ...current,
        submissions: current.submissions.map((item) => item.id === id ? { ...item, status: approved ? 'approved' : 'rejected', note, decidedAt: new Date().toISOString(), decidedBy: userRef.current?.username } : item),
        releases: current.releases.map((release) => release.id === submission.releaseId
          ? { ...release, reviewStatus: approved ? 'approved' : 'rejected', reviewNote: note, isLive: approved }
          : release.appId === submission.appId && approved ? { ...release, isLive: false } : release),
        apps: current.apps.map((app) => app.id === submission.appId ? { ...app, status: approved ? 'published' : 'draft' } : app),
      };
    });
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
      if (saved) patch((current) => ({ ...current, apps: current.apps.map((item) => item.id === id ? saved! : item) }));
      return;
    }
    patch((current) => ({ ...current, apps: current.apps.map((item) => item.id === id ? { ...item, status } : item) }));
  }, [assertCanWrite, patch, apiMode]);

  const reportApp = useCallback(async (app: StoreApp, reason: string, details: string) => {
    assertCanWrite();
    const currentUser = userRef.current;
    if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in with Gothwad to continue.');
    if (apiMode()) {
      const { report } = await userApi.report(app.id, reason, details);
      if (report) patch((current) => ({ ...current, reports: [report, ...current.reports] }));
      return;
    }
    patch((current) => ({ ...current, reports: [{ id: 'rep-' + uid(), appId: app.id, appName: app.name, reporter: currentUser.username, reason, details, status: 'open', createdAt: new Date().toISOString() }, ...current.reports] }));
  }, [assertCanWrite, patch, apiMode]);

  const resolveReport = useCallback(async (id: string, status: ReportItem['status']) => {
    assertCanWrite();
    if (apiMode() && (status === 'resolved' || status === 'dismissed')) {
      const { report } = await adminApi.resolveReport(id, status);
      patch((current) => ({ ...current, reports: current.reports.map((item) => item.id === id ? report : item) }));
      return;
    }
    patch((current) => ({ ...current, reports: current.reports.map((item) => item.id === id ? { ...item, status } : item) }));
  }, [assertCanWrite, patch, apiMode]);

  const liveReleaseOf = useCallback((appId: string) =>
    state.releases.filter((release) => release.appId === appId && release.isLive).sort((a, b) => b.versionCode - a.versionCode)[0],
  [state.releases]);

  const value: Ctx = useMemo(() => ({
    ...state, categories, user, authReady, backendLive, catalogStatus,
    demoModeAvailable, isDemoUser, isPreviewMode,
    isAdmin: serverAdmin ?? (isDemoUser && user?.username === DEMO_USER.username),
    setUser, signInDemo, signOut, toggleWishlist, recordDownload, addReview, replyReview,
    registerDeveloper, createApp, updateApp, addRelease, submitForReview, decideSubmission,
    setAppStatus, reportApp, resolveReport, liveReleaseOf,
  }), [state, categories, user, authReady, backendLive, catalogStatus, demoModeAvailable, isDemoUser, isPreviewMode, serverAdmin, setUser, signInDemo, signOut, toggleWishlist, recordDownload, addReview, replyReview, registerDeveloper, createApp, updateApp, addRelease, submitForReview, decideSubmission, setAppStatus, reportApp, resolveReport, liveReleaseOf]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
