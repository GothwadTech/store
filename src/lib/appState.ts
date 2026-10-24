import type {
  AppRelease,
  Developer,
  GothwadUser,
  ReportItem,
  Review,
  StoreApp,
  Submission,
} from '../types';
import {
  adminApi,
  ApiError,
  devApi,
  userApi,
  type ApkManifestInfo,
  type DeveloperResolutionStatus,
  type UploadedApk,
} from './api';
import { SEED_APPS } from '../data/seed';
import { apkProviderForSize } from './storage';

export interface AppState {
  apps: StoreApp[];
  releases: AppRelease[];
  reviews: Review[];
  submissions: Submission[];
  reports: ReportItem[];
  wishlist: string[];
  library: string[];
  developer: Developer | null;
}

export type NewReleaseInput = {
  versionName: string;
  versionCode: number;
  sizeBytes: number;
  changelog: string;
  permissions: string[];
  apkName: string;
  apkUrl?: string;
  apkProvider?: UploadedApk['provider'];
  apkKey?: string;
  apkSha256?: string;
  manifest?: ApkManifestInfo | null;
};

export const seedReleases: AppRelease[] = SEED_APPS.map((a, i) => ({
  id: 'rel-' + a.id,
  appId: a.id,
  versionName: '1.' + (i + 2) + '.0',
  versionCode: 100 + i,
  apkProvider: 'github',
  apkKey: `releases/${a.packageName}-1.${i + 2}.0.apk`,
  apkUrl: '',
  apkSizeBytes: (6 + i * 7) * 1024 * 1024,
  apkSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  minSdk: 26,
  permissions: ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS'],
  changelog: 'Faster startup, smaller APK, and bug fixes.',
  reviewStatus: 'approved',
  isLive: true,
  createdAt: a.updatedAt,
  downloads: a.downloadsCount,
}));

export const emptyState: AppState = {
  apps: [],
  releases: [],
  reviews: [],
  submissions: [],
  reports: [],
  wishlist: [],
  library: [],
  developer: null,
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map(base.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

export function applyLocalDemoReview(
  current: AppState,
  appId: string,
  user: GothwadUser,
  rating: number,
  body: string,
): AppState {
  const mine = current.reviews.filter((item) => !(item.appId === appId && item.userId === user.id));
  const reviews = [
    ...mine,
    { id: uid(), appId, userId: user.id, username: user.username, rating, body, createdAt: new Date().toISOString() },
  ];
  const forApp = reviews.filter((item) => item.appId === appId);
  const average = forApp.reduce((total, item) => total + item.rating, 0) / Math.max(1, forApp.length);
  const base = current.apps.find((app) => app.id === appId);
  const apps = current.apps.map((app) =>
    app.id === appId
      ? {
          ...app,
          ratingAvg: Math.round(((average + (base?.ratingAvg ?? average)) / 2) * 10) / 10,
          ratingCount: app.ratingCount + 1,
        }
      : app,
  );
  return { ...current, reviews, apps };
}

export function buildLocalDemoApp(
  current: AppState,
  user: GothwadUser | null,
  data: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>,
): StoreApp {
  return {
    id: 'app-' + uid(),
    ...data,
    developerId: current.developer?.id ?? 'dev-' + (user?.username ?? 'preview'),
    developerName: current.developer?.orgName ?? current.developer?.displayName ?? user?.name ?? 'Developer',
    status: 'draft',
    shortDesc: '',
    fullDesc: '',
    iconUrl: '',
    iconColor: '#2563eb',
    screenshots: [],
    tags: [],
    supportEmail: current.developer?.supportEmail ?? user?.email ?? '',
    ratingAvg: 0,
    ratingCount: 0,
    downloadsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildLocalDemoRelease(appId: string, releaseInput: NewReleaseInput): AppRelease {
  return {
    id: 'rel-' + uid(),
    appId,
    versionName: releaseInput.versionName,
    versionCode: releaseInput.versionCode,
    apkProvider: releaseInput.apkProvider ?? apkProviderForSize(releaseInput.sizeBytes),
    apkKey: releaseInput.apkKey ?? releaseInput.apkName,
    apkUrl: releaseInput.apkUrl ?? '',
    apkSizeBytes: releaseInput.sizeBytes,
    apkSha256: releaseInput.apkSha256,
    minSdk: releaseInput.manifest?.minSdk ?? undefined,
    permissions: releaseInput.manifest?.permissions?.length ? releaseInput.manifest.permissions : releaseInput.permissions,
    changelog: releaseInput.changelog,
    reviewStatus: 'pending',
    isLive: false,
    createdAt: new Date().toISOString(),
    downloads: 0,
  };
}

export function applyLocalDemoSubmit(current: AppState, appId: string, releaseId: string): AppState {
  const app = current.apps.find((item) => item.id === appId);
  const release = current.releases.find((item) => item.id === releaseId);
  if (!app || !release) return current;
  return {
    ...current,
    apps: current.apps.map((item) => (item.id === appId ? { ...item, status: 'in_review' } : item)),
    submissions: [
      {
        id: 'sub-' + uid(),
        appId,
        appName: app.name,
        packageName: app.packageName,
        developerName: app.developerName,
        releaseId,
        versionName: release.versionName,
        versionCode: release.versionCode,
        apkProvider: release.apkProvider,
        apkSizeBytes: release.apkSizeBytes,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      },
      ...current.submissions,
    ],
  };
}

export function applyLocalDemoDecide(
  current: AppState,
  id: string,
  approved: boolean,
  note: string,
  decidedBy?: string,
): AppState {
  const submission = current.submissions.find((item) => item.id === id);
  if (!submission) return current;
  return {
    ...current,
    submissions: current.submissions.map((item) =>
      item.id === id
        ? { ...item, status: approved ? 'approved' : 'rejected', note, decidedAt: new Date().toISOString(), decidedBy }
        : item,
    ),
    releases: current.releases.map((release) =>
      release.id === submission.releaseId
        ? { ...release, reviewStatus: approved ? 'approved' : 'rejected', reviewNote: note, isLive: approved }
        : release.appId === submission.appId && approved
          ? { ...release, isLive: false }
          : release,
    ),
    apps: current.apps.map((app) =>
      app.id === submission.appId ? { ...app, status: approved ? 'published' : 'draft' } : app,
    ),
  };
}

export interface ActionDeps {
  getState: () => AppState;
  getUser: () => GothwadUser | null;
  apiMode: () => boolean;
  isLocalDemo: () => boolean;
  assertCanWrite: () => void;
  patch: (fn: (s: AppState) => AppState) => void;
  setDeveloperStatus: (status: DeveloperResolutionStatus) => void;
}

export function createAppActions(deps: ActionDeps) {
  const { getState, getUser, apiMode, isLocalDemo, assertCanWrite, patch, setDeveloperStatus } = deps;

  return {
    toggleWishlist: async (appId: string) => {
      assertCanWrite();
      const wished = getState().wishlist.includes(appId);
      if (apiMode()) await userApi.setWishlist(appId, !wished);
      patch((c) => ({ ...c, wishlist: wished ? c.wishlist.filter((id) => id !== appId) : [...c.wishlist, appId] }));
    },
    recordDownload: async (app: StoreApp) => {
      if (apiMode()) {
        const liveRel = getState().releases.filter((r) => r.appId === app.id && r.isLive).sort((a, b) => b.versionCode - a.versionCode)[0];
        void userApi.touchLibrary(app.id, liveRel?.versionCode).catch(() => {});
      } else if (!isLocalDemo()) {
        return;
      }
      patch((c) => ({
        ...c,
        apps: c.apps.map((item) => (item.id === app.id ? { ...item, downloadsCount: item.downloadsCount + 1 } : item)),
        library: c.library.includes(app.id) ? c.library : [...c.library, app.id],
      }));
    },
    addReview: async (appId: string, rating: number, body: string) => {
      assertCanWrite();
      const currentUser = getUser();
      if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
      if (apiMode()) {
        const { review } = await userApi.addReview(appId, rating, body);
        patch((c) => {
          const reviews = [...c.reviews.filter((item) => !(item.appId === appId && item.userId === currentUser.id)), review];
          const forApp = reviews.filter((item) => item.appId === appId);
          const avg = forApp.reduce((t, item) => t + item.rating, 0) / Math.max(1, forApp.length);
          return {
            ...c, reviews,
            apps: c.apps.map((app) => (app.id === appId ? { ...app, ratingAvg: Math.round(avg * 10) / 10, ratingCount: forApp.length } : app)),
          };
        });
        return;
      }
      patch((c) => applyLocalDemoReview(c, appId, currentUser, rating, body));
    },
    replyReview: async (reviewId: string, reply: string) => {
      assertCanWrite();
      if (apiMode()) {
        const review = getState().reviews.find((item) => item.id === reviewId);
        if (!review) return;
        const { review: saved } = await devApi.reply(review.appId, reviewId, reply);
        patch((c) => ({ ...c, reviews: c.reviews.map((item) => (item.id === reviewId ? saved : item)) }));
        return;
      }
      patch((c) => ({
        ...c,
        reviews: c.reviews.map((item) => (item.id === reviewId ? { ...item, developerReply: reply, developerReplyAt: new Date().toISOString() } : item)),
      }));
    },
    registerDeveloper: async (data: Omit<Developer, 'id' | 'userId' | 'username' | 'verified' | 'createdAt'>) => {
      assertCanWrite();
      const currentUser = getUser();
      if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
      if (apiMode()) {
        const { developer } = await devApi.register(data);
        patch((c) => ({ ...c, developer }));
        setDeveloperStatus('ready');
        return;
      }
      patch((c) => ({
        ...c,
        developer: { ...data, id: 'dev-' + currentUser.username, userId: currentUser.id, username: currentUser.username, verified: false, createdAt: new Date().toISOString() },
      }));
      setDeveloperStatus('ready');
    },
    createApp: async (input: Pick<StoreApp, 'name' | 'packageName' | 'category' | 'kind'>): Promise<StoreApp> => {
      assertCanWrite();
      if (apiMode()) {
        const { app } = await devApi.createApp(input);
        patch((c) => ({ ...c, apps: [app, ...c.apps.filter((item) => item.id !== app.id)] }));
        return app;
      }
      const app = buildLocalDemoApp(getState(), getUser(), input);
      patch((c) => ({ ...c, apps: [app, ...c.apps] }));
      return app;
    },
    updateApp: async (id: string, changes: Partial<StoreApp>) => {
      assertCanWrite();
      if (apiMode()) {
        const { app } = await devApi.updateApp(id, changes);
        patch((c) => ({ ...c, apps: c.apps.map((item) => (item.id === id ? app : item)) }));
        return;
      }
      patch((c) => ({
        ...c, apps: c.apps.map((item) => (item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item)),
      }));
    },
    addRelease: async (appId: string, input: NewReleaseInput): Promise<AppRelease> => {
      assertCanWrite();
      if (apiMode()) {
        const { release } = await devApi.createRelease(appId, {
          versionName: input.versionName, versionCode: input.versionCode, changelog: input.changelog,
          minSdk: input.manifest?.minSdk, targetSdk: input.manifest?.targetSdk, permissions: input.permissions,
          apk: { provider: input.apkProvider ?? apkProviderForSize(input.sizeBytes), url: input.apkUrl, key: input.apkKey ?? input.apkName, sizeBytes: input.sizeBytes, sha256: input.apkSha256 },
          manifest: input.manifest ?? { permissions: input.permissions },
        });
        patch((c) => ({ ...c, releases: [release, ...c.releases.filter((item) => item.id !== release.id)] }));
        return release;
      }
      const release = buildLocalDemoRelease(appId, input);
      patch((c) => ({
        ...c, releases: [release, ...c.releases],
        apps: c.apps.map((app) => (app.id === appId ? { ...app, updatedAt: release.createdAt } : app)),
      }));
      return release;
    },
    submitForReview: async (appId: string, releaseId: string) => {
      assertCanWrite();
      if (apiMode()) {
        const { submission } = await devApi.submit(appId, releaseId);
        patch((c) => ({
          ...c,
          submissions: [submission, ...c.submissions.filter((item) => item.id !== submission.id)],
          apps: c.apps.map((app) => (app.id === appId && app.status !== 'published' ? { ...app, status: 'in_review' } : app)),
        }));
        return;
      }
      patch((c) => applyLocalDemoSubmit(c, appId, releaseId));
    },
    decideSubmission: async (id: string, approved: boolean, note: string) => {
      assertCanWrite();
      if (apiMode()) {
        const { submission } = await adminApi.decide(id, approved, note);
        try {
          const [adminApps, queue] = await Promise.all([adminApi.apps(), adminApi.queue()]);
          patch((c) => ({
            ...c,
            apps: mergeById(c.apps.filter((app) => !adminApps.apps.some((item) => item.id === app.id)), adminApps.apps),
            releases: mergeById(c.releases, [...adminApps.releases, ...queue.releases]),
            submissions: mergeById([submission], [...adminApps.submissions, ...queue.submissions].filter((item) => item.id !== submission.id)),
          }));
        } catch {
          patch((c) => ({ ...c, submissions: c.submissions.map((item) => (item.id === id ? submission : item)) }));
        }
        return;
      }
      patch((c) => applyLocalDemoDecide(c, id, approved, note, getUser()?.username));
    },
    setAppStatus: async (id: string, status: StoreApp['status']) => {
      assertCanWrite();
      if (apiMode()) {
        const app = getState().apps.find((item) => item.id === id);
        const mine = !!app && !!getState().developer && app.developerId === getState().developer?.id;
        let saved: StoreApp | null = null;
        if (status === 'suspended') saved = (await adminApi.suspend(id)).app;
        else if (status === 'published' && (!mine || app?.status === 'suspended')) saved = (await adminApi.restore(id)).app;
        else if (status === 'published' || status === 'unlisted') saved = (await devApi.setStatus(id, status)).app;
        if (saved) patch((c) => ({ ...c, apps: c.apps.map((item) => (item.id === id ? saved! : item)) }));
        return;
      }
      patch((c) => ({ ...c, apps: c.apps.map((item) => (item.id === id ? { ...item, status } : item)) }));
    },
    reportApp: async (app: StoreApp, reason: string, details: string) => {
      assertCanWrite();
      const currentUser = getUser();
      if (!currentUser) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
      if (apiMode()) {
        const { report } = await userApi.report(app.id, reason, details);
        if (report) patch((c) => ({ ...c, reports: [report, ...c.reports] }));
        return;
      }
      patch((c) => ({
        ...c,
        reports: [{ id: 'rep-' + uid(), appId: app.id, appName: app.name, reporter: currentUser.username, reason, details, status: 'open', createdAt: new Date().toISOString() }, ...c.reports],
      }));
    },
    resolveReport: async (id: string, status: ReportItem['status']) => {
      assertCanWrite();
      if (apiMode() && (status === 'resolved' || status === 'dismissed')) {
        const { report } = await adminApi.resolveReport(id, status);
        patch((c) => ({ ...c, reports: c.reports.map((item) => (item.id === id ? report : item)) }));
        return;
      }
      patch((c) => ({ ...c, reports: c.reports.map((item) => (item.id === id ? { ...item, status } : item)) }));
    },
  };
}
