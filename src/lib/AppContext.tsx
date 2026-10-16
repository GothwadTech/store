import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppRelease, Developer, GothwadUser, ReportItem, Review, StoreApp, Submission } from '../types';
import { CATEGORIES, SEED_APPS, SEED_REPORTS, SEED_REVIEWS, SEED_SUBMISSIONS } from '../data/seed';
import { apkProviderForSize } from './storage';
import { DEMO_USER, fetchMe, isProductionHost, signOut as authSignOut } from './auth';

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

interface Ctx extends AppState {
  categories: typeof CATEGORIES;
  user: GothwadUser | null;
  authReady: boolean;
  isAdmin: boolean;
  signInDemo: () => void;
  setUser: (u: GothwadUser | null) => void;
  signOut: () => void;
  toggleWishlist: (appId: string) => void;
  recordDownload: (app: StoreApp) => void;
  addReview: (appId: string, rating: number, body: string) => void;
  replyReview: (reviewId: string, reply: string) => void;
  registerDeveloper: (d: Omit<Developer, 'id' | 'userId' | 'username' | 'verified' | 'createdAt'>) => void;
  createApp: (a: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>) => StoreApp;
  updateApp: (id: string, patch: Partial<StoreApp>) => void;
  addRelease: (appId: string, r: { versionName: string; versionCode: number; sizeBytes: number; changelog: string; permissions: string[]; apkName: string }) => AppRelease;
  submitForReview: (appId: string, releaseId: string) => void;
  decideSubmission: (id: string, ok: boolean, note: string) => void;
  setAppStatus: (id: string, status: StoreApp['status']) => void;
  reportApp: (app: StoreApp, reason: string, details: string) => void;
  resolveReport: (id: string, status: ReportItem['status']) => void;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [user, setUserState] = useState<GothwadUser | null>(() => {
    try {
      const raw = sessionStorage.getItem('gothwad-demo-user');
      return raw ? (JSON.parse(raw) as GothwadUser) : null;
    } catch { return null; }
  });
  const [authReady, setAuthReady] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  // Asli session: Worker /api/me (Accounts cookie / Bearer). OAuth callback bhi yahi se bharta hai.
  useEffect(() => {
    fetchMe().then((u) => {
      if (u) setUserState(u);
      setAuthReady(true);
    });
  }, []);

  const setUser = useCallback((u: GothwadUser | null) => {
    setUserState(u);
    if (u) sessionStorage.setItem('gothwad-demo-user', JSON.stringify(u));
    else sessionStorage.removeItem('gothwad-demo-user');
  }, []);

  const signInDemo = useCallback(() => setUser(DEMO_USER), [setUser]);
  const signOut = useCallback(() => { void authSignOut(); setUser(null); }, [setUser]);

  const patch = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  const toggleWishlist = useCallback((appId: string) =>
    patch((s) => ({ ...s, wishlist: s.wishlist.includes(appId) ? s.wishlist.filter((x) => x !== appId) : [...s.wishlist, appId] })), [patch]);

  const recordDownload = useCallback((app: StoreApp) =>
    patch((s) => ({
      ...s,
      apps: s.apps.map((a) => (a.id === app.id ? { ...a, downloadsCount: a.downloadsCount + 1 } : a)),
      library: s.library.includes(app.id) ? s.library : [...s.library, app.id],
    })), [patch]);

  const addReview = useCallback((appId: string, rating: number, body: string) => {
    if (!user) return;
    patch((s) => {
      const mine = s.reviews.filter((r) => !(r.appId === appId && r.userId === user.id));
      const reviews = [...mine, { id: uid(), appId, userId: user.id, username: user.username, rating, body, createdAt: new Date().toISOString() }];
      const forApp = reviews.filter((r) => r.appId === appId);
      const avg = forApp.reduce((t, r) => t + r.rating, 0) / Math.max(1, forApp.length);
      const base = s.apps.find((a) => a.id === appId);
      const apps = s.apps.map((a) =>
        a.id === appId ? { ...a, ratingAvg: Math.round((avg + (base?.ratingAvg ?? avg)) / 2 * 10) / 10, ratingCount: a.ratingCount + 1 } : a);
      return { ...s, reviews, apps };
    });
  }, [patch, user]);

  const replyReview = useCallback((reviewId: string, reply: string) =>
    patch((s) => ({ ...s, reviews: s.reviews.map((r) => r.id === reviewId ? { ...r, developerReply: reply, developerReplyAt: new Date().toISOString() } : r) })), [patch]);

  const registerDeveloper = useCallback((d: Omit<Developer, 'id' | 'userId' | 'username' | 'verified' | 'createdAt'>) => {
    if (!user) return;
    patch((s) => ({ ...s, developer: { ...d, id: 'dev-' + user.username, userId: user.id, username: user.username, verified: false, createdAt: new Date().toISOString() } }));
  }, [patch, user]);

  const createApp = useCallback((a: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>): StoreApp => {
    const created: StoreApp = {
      id: 'app-' + uid(), ...a,
      developerId: state.developer?.id ?? 'dev-' + (user?.username ?? 'demo'),
      developerName: state.developer?.orgName ?? state.developer?.displayName ?? user?.name ?? 'Developer',
      status: 'draft', shortDesc: '', fullDesc: '',
      iconUrl: '', iconColor: '#2563eb', screenshots: [], tags: [],
      supportEmail: state.developer?.supportEmail ?? user?.email ?? '',
      ratingAvg: 0, ratingCount: 0, downloadsCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    patch((s) => ({ ...s, apps: [created, ...s.apps] }));
    return created;
  }, [patch, state.developer, user]);

  const updateApp = useCallback((id: string, p: Partial<StoreApp>) =>
    patch((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? { ...a, ...p, updatedAt: new Date().toISOString() } : a)) })), [patch]);

  const addRelease = useCallback((appId: string, r: { versionName: string; versionCode: number; sizeBytes: number; changelog: string; permissions: string[]; apkName: string }): AppRelease => {
    const release: AppRelease = {
      id: 'rel-' + uid(), appId,
      versionName: r.versionName, versionCode: r.versionCode,
      apkProvider: apkProviderForSize(r.sizeBytes), // RULE: <=25MB github, >25MB b2
      apkKey: r.apkName, apkUrl: `/api/download/rel-${uid()}`,
      apkSizeBytes: r.sizeBytes, permissions: r.permissions,
      changelog: r.changelog, reviewStatus: 'pending', isLive: false,
      createdAt: new Date().toISOString(), downloads: 0,
    };
    patch((s) => ({ ...s, releases: [release, ...s.releases] }));
    return release;
  }, [patch]);

  const submitForReview = useCallback((appId: string, releaseId: string) => {
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
  }, [patch]);

  const decideSubmission = useCallback((id: string, ok: boolean, note: string) => {
    patch((s) => {
      const sub = s.submissions.find((x) => x.id === id);
      if (!sub) return s;
      return {
        ...s,
        submissions: s.submissions.map((x) => x.id === id ? { ...x, status: ok ? 'approved' as const : 'rejected' as const, note, decidedAt: new Date().toISOString(), decidedBy: user?.username } : x),
        releases: s.releases.map((r) => r.id === sub.releaseId
          ? { ...r, reviewStatus: ok ? 'approved' as const : 'rejected' as const, reviewNote: note, isLive: ok }
          : r.appId === sub.appId && ok ? { ...r, isLive: false } : r),
        apps: s.apps.map((a) => a.id === sub.appId ? { ...a, status: ok ? 'published' as const : 'draft' as const } : a),
      };
    });
  }, [patch, user]);

  const setAppStatus = useCallback((id: string, status: StoreApp['status']) =>
    patch((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? { ...a, status } : a)) })), [patch]);

  const reportApp = useCallback((app: StoreApp, reason: string, details: string) => {
    if (!user) return;
    patch((s) => ({ ...s, reports: [{ id: 'rep-' + uid(), appId: app.id, appName: app.name, reporter: user.username, reason, details, status: 'open' as const, createdAt: new Date().toISOString() }, ...s.reports] }));
  }, [patch, user]);

  const resolveReport = useCallback((id: string, status: ReportItem['status']) =>
    patch((s) => ({ ...s, reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)) })), [patch]);

  const liveReleaseOf = useCallback((appId: string) =>
    state.releases.filter((r) => r.appId === appId && r.isLive).sort((a, b) => b.versionCode - a.versionCode)[0], [state.releases]);

  const value: Ctx = useMemo(() => ({
    ...state, categories: CATEGORIES, user, authReady,
    // Admin = Accounts username ADMIN_USERNAMES me (Worker /api/me bhi yahi batayega).
    // Demo me pawan admin hai taaki preview me panel ghuma sako.
    isAdmin: !!user && (user.username === 'pawan' || (!isProductionHost() && user.username === DEMO_USER.username)),
    setUser, signInDemo, signOut, toggleWishlist, recordDownload, addReview, replyReview,
    registerDeveloper, createApp, updateApp, addRelease, submitForReview, decideSubmission,
    setAppStatus, reportApp, resolveReport, liveReleaseOf,
  }), [state, user, authReady, setUser, signInDemo, signOut, toggleWishlist, recordDownload, addReview, replyReview, registerDeveloper, createApp, updateApp, addRelease, submitForReview, decideSubmission, setAppStatus, reportApp, resolveReport, liveReleaseOf]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
