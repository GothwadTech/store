import type {
  AppRelease,
  Developer,
  GothwadUser,
  ReportItem,
  Review,
  StoreApp,
  Submission,
} from '../types';
import type { ApkManifestInfo, UploadedApk } from './api';
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
