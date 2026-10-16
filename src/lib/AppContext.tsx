import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppRelease, Category, Developer, GothwadUser, ReportItem, Review, StoreApp, Submission } from '../types';
import { CATEGORIES, SEED_APPS, SEED_REPORTS, SEED_REVIEWS, SEED_SUBMISSIONS } from '../data/seed';
import { apkProviderForSize } from './storage';
import { DEMO_USER, isProductionHost, signOut as authSignOut } from './auth';
import { adminApi, devApi, fetchCatalog, fetchSession, isUnconfiguredError, userApi } from './api';
import type { ApkManifestInfo } from './api';

const LS_KEY = 'gothwad-store-state-v1';

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
  /** Live mode me upload flow se aaye hue asal values (GitHub/B2 URL wagera). */
  apkUrl?: string;
  apkProvider?: 'github' | 'b2';
  apkKey?: string;
  apkSha256?: string;
  manifest?: ApkManifestInfo | null;
}

interface Ctx extends AppState {
  categories: Category[];
  user: GothwadUser | null;
  authReady: boolean;
  isAdmin: boolean;
  /** true = Worker+Supabase live hai, actions API par jayenge. false = seed/local demo mode. */
  backendLive: boolean;
  isDemoUser: boolean;
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

const seedReleases: AppRelease[] = SEED_APPS.map((a, i) => ({
  id: `rel-seed-${a.id}`,
  appId: a.id,
  versionCode: 10 + i,
  versionName: `1.${i}.0`,
  apkProvider: i % 3 === 2 ? 'b2' : 'github',
  apkKey: `${a.packageName}/${a.packageName}-10${i}.apk`,
  apkUrl: `/api/download/rel-seed-${a.id}`,
  apkSizeBytes: (i % 3 === 2 ? 86 : 14 + i) * 1024 * 1024,
  minSdk: 24,
  permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
  changelog: 'Performance improvements and bug fixes.',
  reviewStatus: 'approved',
  isLive: true,
  createdAt: new Date().toISOString(),
  downloads: Math.round(a.downloadsCount * 0.7),
}));

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.apps) && parsed.apps.length) return parsed;
    }
  } catch { /* ignore */ }
  return {
    apps: SEED_APPS, releases: seedReleases, reviews: SEED_REVIEWS,
    submissions: SEED_SUBMISSIONS, reports: SEED_REPORTS,
    wishlist: [], library: [], developer: null,
  };
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const map = new Map(base.map((x) => [x.id, x]));
  for (const x of extra) map.set(x.id, x);
  return [...map.values()];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [backendLive, setBackendLive] = useState(false);
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);
  const [user, setUserState] = useState<GothwadUser | null>(() => {
    try {
      const raw = sessionStorage.getItem('gothwad-demo-user');
      return raw ? (JSON.parse(raw) as GothwadUser) : null;
    } catch { return null; }
  });
  const [authReady, setAuthReady] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const liveRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  /** Live API tabhi use hogi jab backend configured ho AUR asal (demo nahi) user ho. */
  const apiMode = useCallback(() => liveRef.current && !!userRef.current && userRef.current.id !== DEMO_USER.id, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (liveRef.current) return; // Live data localStorage me persist mat karo - Worker hi source of truth hai.
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const patch = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  // ── Boot hydration: session → public catalog → dev/admin bundles ──
  // Backend unconfigured mile to seed/local state hi chalta rahega (demo loop).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await fetchSession();
      if (cancelled) return;
      if (session?.user) {
        setUserState(session.user);
        userRef.current = session.user;
        setServerAdmin(session.isAdmin);
        if (session.developer) patch((s) => ({ ...s, developer: session.developer }));
      }
      const catalog = await fetchCatalog();
      if (cancelled) return;
      if (catalog.live) {
        liveRef.current = true;
        setBackendLive(true);
        if (catalog.categories.length) setCategories(catalog.categories);
        setState((s) => ({
          ...s,
          apps: catalog.apps, releases: catalog.releases, reviews: catalog.reviews,
          submissions: [], reports: [],
        }));
        const realUser = session?.user && session.user.id !== DEMO_USER.id ? session.user : null;
        if (realUser) {
          try {
            const [lib, wish] = await Promise.all([userApi.libraryIds(), userApi.wishlistIds()]);
            if (!cancelled) patch((s) => ({ ...s, library: lib.appIds, wishlist: wish.appIds }));
          } catch { /* ignore */ }
          if (session?.developer) {
            try {
              const bundle = await devApi.bundle();
              if (!cancelled) patch((s) => ({
                ...s, developer: bundle.developer,
                apps: mergeById(s.apps, bundle.apps),
                releases: mergeById(s.releases, bundle.releases),
                reviews: mergeById(s.reviews, bundle.reviews),
                submissions: bundle.submissions,
              }));
            } catch { /* developer bundle optional hai */ }
          }
          if (session?.isAdmin) {
            try {
              const [adminApps, queue, reports] = await Promise.all([adminApi.apps(), adminApi.queue(), adminApi.reports()]);
              if (!cancelled) patch((s) => ({
                ...s,
                apps: mergeById(s.apps, adminApps.apps),
                releases: mergeById(s.releases, [...adminApps.releases, ...queue.releases]),
                submissions: mergeById(adminApps.submissions, queue.submissions),
                reports: reports.reports,
              }));
            } catch { /* admin bundle optional hai */ }
          }
        }
      }
      if (!cancelled) setAuthReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUser = useCallback((u: GothwadUser | null) => {
    setUserState(u);
    if (u) sessionStorage.setItem('gothwad-demo-user', JSON.stringify(u));
    else sessionStorage.removeItem('gothwad-demo-user');
  }, []);

  const signInDemo = useCallback(() => setUser(DEMO_USER), [setUser]);
  const signOut = useCallback(() => { void authSignOut(); setServerAdmin(null); setUser(null); }, [setUser]);

  const toggleWishlist = useCallback(async (appId: string) => {
    const wished = stateRef.current.wishlist.includes(appId);
    patch((s) => ({ ...s, wishlist: wished ? s.wishlist.filter((x) => x !== appId) : [...s.wishlist, appId] }));
    if (!apiMode()) return;
    try { await userApi.setWishlist(appId, !wished); }
    catch { patch((s) => ({ ...s, wishlist: wished ? [...s.wishlist, appId] : s.wishlist.filter((x) => x !== appId) })); }
  }, [patch, apiMode]);

  const recordDownload = useCallback(async (app: StoreApp) => {
    patch((s) => ({
      ...s,
      apps: s.apps.map((a) => (a.id === app.id ? { ...a, downloadsCount: a.downloadsCount + 1 } : a)),
      library: s.library.includes(app.id) ? s.library : [...s.library, app.id],
    }));
    // Asal counting Worker /api/download/:releaseId par hota hai (link open hone par);
    // yahan sirf library entry pakki karte hain.
    if (apiMode()) { try { await userApi.touchLibrary(app.id); } catch { /* ignore */ } }
  }, [patch, apiMode]);

  const addReview = useCallback(async (appId: string, rating: number, body: string) => {
    const u = userRef.current;
    if (!u) return;
    if (apiMode()) {
      const { review } = await userApi.addReview(appId, rating, body);
      patch((s) => {
        const reviews = [...s.reviews.filter((r) => !(r.appId === appId && r.userId === u.id)), review];
        const forApp = reviews.filter((r) => r.appId === appId);
        const avg = forApp.reduce((t, r) => t + r.rating, 0) / Math.max(1, forApp.length);
        return { ...s, reviews, apps: s.apps.map((a) => (a.id === appId ? { ...a, ratingAvg: Math.round(avg * 10) / 10, ratingCount: forApp.length } : a)) };
      });
      return;
    }
    patch((s) => {
      const mine = s.reviews.filter((r) => !(r.appId === appId && r.userId === u.id));
      const reviews = [...mine, { id: uid(), appId, userId: u.id, username: u.username, rating, body, createdAt: new Date().toISOString() }];
      const forApp = reviews.filter((r) => r.appId === appId);
      const avg = forApp.reduce((t, r) => t + r.rating, 0) / Math.max(1, forApp.length);
      const base = s.apps.find((a) => a.id === appId);
      const apps = s.apps.map((a) =>
        a.id === appId ? { ...a, ratingAvg: Math.round((avg + (base?.ratingAvg ?? avg)) / 2 * 10) / 10, ratingCount: a.ratingCount + 1 } : a);
      return { ...s, reviews, apps };
    });
  }, [patch, apiMode]);

  const replyReview = useCallback(async (reviewId: string, reply: string) => {
    if (apiMode()) {
      const review = stateRef.current.reviews.find((r) => r.id === reviewId);
      if (!review) return;
      const { review: saved } = await devApi.reply(review.appId, reviewId, reply);
      patch((s) => ({ ...s, reviews: s.reviews.map((r) => (r.id === reviewId ? saved : r)) }));
      return;
    }
    patch((s) => ({ ...s, reviews: s.reviews.map((r) => (r.id === reviewId ? { ...r, developerReply: reply, developerReplyAt: new Date().toISOString() } : r)) }));
  }, [patch, apiMode]);

  const registerDeveloper = useCallback(async (d: Omit<Developer, 'id' | 'userId' | 'username' | 'verified' | 'createdAt'>) => {
    const u = userRef.current;
    if (!u) return;
    if (apiMode()) {
      try {
        const { developer } = await devApi.register(d);
        patch((s) => ({ ...s, developer }));
        return;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    patch((s) => ({ ...s, developer: { ...d, id: 'dev-' + u.username, userId: u.id, username: u.username, verified: false, createdAt: new Date().toISOString() } }));
  }, [patch, apiMode]);

  const createApp = useCallback(async (a: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>): Promise<StoreApp> => {
    if (apiMode()) {
      try {
        const { app } = await devApi.createApp(a);
        patch((s) => ({ ...s, apps: [app, ...s.apps.filter((x) => x.id !== app.id)] }));
        return app;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    const u = userRef.current;
    const created: StoreApp = {
      id: 'app-' + uid(), ...a,
      developerId: stateRef.current.developer?.id ?? 'dev-' + (u?.username ?? 'demo'),
      developerName: stateRef.current.developer?.orgName ?? stateRef.current.developer?.displayName ?? u?.name ?? 'Developer',
      status: 'draft', shortDesc: '', fullDesc: '',
      iconUrl: '', iconColor: '#2563eb', screenshots: [], tags: [],
      supportEmail: stateRef.current.developer?.supportEmail ?? u?.email ?? '',
      ratingAvg: 0, ratingCount: 0, downloadsCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    patch((s) => ({ ...s, apps: [created, ...s.apps] }));
    return created;
  }, [patch, apiMode]);

  const updateApp = useCallback(async (id: string, p: Partial<StoreApp>) => {
    if (apiMode()) {
      try {
        const { app } = await devApi.updateApp(id, p);
        patch((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? app : a)) }));
        return;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    patch((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? { ...a, ...p, updatedAt: new Date().toISOString() } : a)) }));
  }, [patch, apiMode]);

  const addRelease = useCallback(async (appId: string, r: NewReleaseInput): Promise<AppRelease> => {
    if (apiMode()) {
      try {
        const { release } = await devApi.createRelease(appId, {
          versionName: r.versionName, versionCode: r.versionCode, changelog: r.changelog,
          permissions: r.manifest?.permissions?.length ? r.manifest.permissions : r.permissions,
          manifest: r.manifest ?? undefined,
          apk: {
            provider: r.apkProvider ?? apkProviderForSize(r.sizeBytes),
            url: r.apkUrl ?? '', key: r.apkKey ?? r.apkName,
            sizeBytes: r.sizeBytes, sha256: r.apkSha256,
          },
        });
        patch((s) => ({ ...s, releases: [release, ...s.releases] }));
        return release;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    const release: AppRelease = {
      id: 'rel-' + uid(), appId,
      versionName: r.versionName, versionCode: r.versionCode,
      apkProvider: r.apkProvider ?? apkProviderForSize(r.sizeBytes), // RULE: <=25MB github, >25MB b2
      apkKey: r.apkKey ?? r.apkName, apkUrl: r.apkUrl ?? `/api/download/rel-${uid()}`,
      apkSizeBytes: r.sizeBytes, apkSha256: r.apkSha256,
      minSdk: r.manifest?.minSdk ?? undefined,
      permissions: r.manifest?.permissions?.length ? r.manifest.permissions : r.permissions,
      changelog: r.changelog, reviewStatus: 'pending', isLive: false,
      createdAt: new Date().toISOString(), downloads: 0,
    };
    patch((s) => ({ ...s, releases: [release, ...s.releases] }));
    return release;
  }, [patch, apiMode]);

  const submitForReview = useCallback(async (appId: string, releaseId: string) => {
    if (apiMode()) {
      try {
        const { submission } = await devApi.submit(appId, releaseId);
        patch((s) => ({
          ...s,
          submissions: [submission, ...s.submissions.filter((x) => x.id !== submission.id)],
          apps: s.apps.map((a) => (a.id === appId && a.status !== 'published' ? { ...a, status: 'in_review' as const } : a)),
        }));
        return;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    patch((s) => {
      const app = s.apps.find((a) => a.id === appId);
      const rel = s.releases.find((r) => r.id === releaseId);
      if (!app || !rel) return s;
      return {
        ...s,
        apps: s.apps.map((a) => (a.id === appId ? { ...a, status: 'in_review' as const } : a)),
        submissions: [{
          id: 'sub-' + uid(), appId, appName: app.name, packageName: app.packageName,
          developerName: app.developerName, releaseId, versionName: rel.versionName,
          versionCode: rel.versionCode, apkProvider: rel.apkProvider, apkSizeBytes: rel.apkSizeBytes,
          status: 'pending' as const, submittedAt: new Date().toISOString(),
        }, ...s.submissions],
      };
    });
  }, [patch, apiMode]);

  const decideSubmission = useCallback(async (id: string, ok: boolean, note: string) => {
    if (apiMode()) {
      const { submission } = await adminApi.decide(id, ok, note);
      // App/release ki nayi sthiti server se hi pakki karo
      try {
        const [adminApps, queue] = await Promise.all([adminApi.apps(), adminApi.queue()]);
        patch((s) => ({
          ...s,
          apps: mergeById(s.apps.filter((a) => !adminApps.apps.some((x) => x.id === a.id)), adminApps.apps),
          releases: mergeById(s.releases, [...adminApps.releases, ...queue.releases]),
          submissions: mergeById([submission], [...adminApps.submissions, ...queue.submissions].filter((x) => x.id !== submission.id)),
        }));
      } catch {
        patch((s) => ({ ...s, submissions: s.submissions.map((x) => (x.id === id ? submission : x)) }));
      }
      return;
    }
    patch((s) => {
      const sub = s.submissions.find((x) => x.id === id);
      if (!sub) return s;
      return {
        ...s,
        submissions: s.submissions.map((x) => (x.id === id ? { ...x, status: ok ? 'approved' as const : 'rejected' as const, note, decidedAt: new Date().toISOString(), decidedBy: userRef.current?.username } : x)),
        releases: s.releases.map((r) => (r.id === sub.releaseId
          ? { ...r, reviewStatus: ok ? 'approved' as const : 'rejected' as const, reviewNote: note, isLive: ok }
          : r.appId === sub.appId && ok ? { ...r, isLive: false } : r)),
        apps: s.apps.map((a) => (a.id === sub.appId ? { ...a, status: ok ? 'published' as const : 'draft' as const } : a)),
      };
    });
  }, [patch, apiMode]);

  const setAppStatus = useCallback(async (id: string, status: StoreApp['status']) => {
    if (apiMode()) {
      try {
        const app = stateRef.current.apps.find((a) => a.id === id);
        const mine = !!app && !!stateRef.current.developer && app.developerId === stateRef.current.developer.id;
        let saved: StoreApp | null = null;
        if (status === 'suspended') saved = (await adminApi.suspend(id)).app;
        else if (status === 'published' && !mine) saved = (await adminApi.restore(id)).app;
        else if (status === 'published' || status === 'unlisted') saved = (await devApi.setStatus(id, status)).app;
        if (saved) { const s2 = saved; patch((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? s2 : a)) })); }
        return;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    patch((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? { ...a, status } : a)) }));
  }, [patch, apiMode]);

  const reportApp = useCallback(async (app: StoreApp, reason: string, details: string) => {
    const u = userRef.current;
    if (!u) return;
    if (apiMode()) {
      try {
        const { report } = await userApi.report(app.id, reason, details);
        if (report) patch((s) => ({ ...s, reports: [report, ...s.reports] }));
        return;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    patch((s) => ({ ...s, reports: [{ id: 'rep-' + uid(), appId: app.id, appName: app.name, reporter: u.username, reason, details, status: 'open' as const, createdAt: new Date().toISOString() }, ...s.reports] }));
  }, [patch, apiMode]);

  const resolveReport = useCallback(async (id: string, status: ReportItem['status']) => {
    if (apiMode() && (status === 'resolved' || status === 'dismissed')) {
      try {
        const { report } = await adminApi.resolveReport(id, status);
        patch((s) => ({ ...s, reports: s.reports.map((r) => (r.id === id ? report : r)) }));
        return;
      } catch (e) { if (!isUnconfiguredError(e)) throw e; }
    }
    patch((s) => ({ ...s, reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)) }));
  }, [patch, apiMode]);

  const liveReleaseOf = useCallback((appId: string) =>
    state.releases.filter((r) => r.appId === appId && r.isLive).sort((a, b) => b.versionCode - a.versionCode)[0], [state.releases]);

  const isDemoUser = !!user && user.id === DEMO_USER.id;

  const value: Ctx = useMemo(() => ({
    ...state, categories, user, authReady, backendLive, isDemoUser,
    // Admin = Worker /api/me ka isAdmin (ADMIN_USERNAMES). Demo me pawan admin
    // hai taaki preview me panel ghuma sako (sirf non-production par).
    isAdmin: serverAdmin ?? (!!user && !isProductionHost() && user.username === DEMO_USER.username),
    setUser, signInDemo, signOut, toggleWishlist, recordDownload, addReview, replyReview,
    registerDeveloper, createApp, updateApp, addRelease, submitForReview, decideSubmission,
    setAppStatus, reportApp, resolveReport, liveReleaseOf,
  }), [state, categories, user, authReady, backendLive, isDemoUser, serverAdmin, setUser, signInDemo, signOut, toggleWishlist, recordDownload, addReview, replyReview, registerDeveloper, createApp, updateApp, addRelease, submitForReview, decideSubmission, setAppStatus, reportApp, resolveReport, liveReleaseOf]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
