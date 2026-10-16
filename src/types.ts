// Gothwad Store - shared types (Web Store + Console + Admin + Android API ek hi shape)
export type AppStatus = 'draft' | 'in_review' | 'published' | 'unlisted' | 'suspended';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type StorageProvider = 'github' | 'imgbb';

export interface Developer {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  orgName: string;
  supportEmail: string;
  website?: string;
  logoUrl?: string;
  verified: boolean;
  createdAt: string;
}

export interface AppRelease {
  id: string;
  appId: string;
  versionCode: number;
  versionName: string;
  /** APK hamesha GothwadTech/storefiles GitHub Releases par hota hai. */
  apkProvider: Extract<StorageProvider, 'github'>;
  apkKey: string;
  apkUrl: string;
  apkSizeBytes: number;
  apkSha256?: string;
  minSdk?: number;
  permissions: string[];
  changelog: string;
  reviewStatus: ReviewStatus;
  reviewNote?: string;
  isLive: boolean;
  createdAt: string;
  downloads: number;
}

export interface StoreApp {
  id: string;
  packageName: string;
  name: string;
  developerId: string;
  developerName: string;
  developerVerified?: boolean;
  category: string;
  kind: 'app' | 'game';
  status: AppStatus;
  shortDesc: string;
  fullDesc: string;
  /** Images hamesha ImgBB par (PLAN SS6) */
  iconUrl: string;
  iconColor: string;
  featureGraphicUrl?: string;
  screenshots: string[];
  tags: string[];
  supportEmail: string;
  website?: string;
  privacyPolicyUrl?: string;
  ratingAvg: number;
  ratingCount: number;
  downloadsCount: number;
  featured?: 'hero' | 'editors' | 'top_new';
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  appId: string;
  userId: string;
  username: string;
  rating: number;
  body: string;
  developerReply?: string;
  developerReplyAt?: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  appId: string;
  appName: string;
  packageName: string;
  developerName: string;
  releaseId: string;
  versionName: string;
  versionCode: number;
  apkProvider: string;
  apkSizeBytes: number;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  submittedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ReportItem {
  id: string;
  appId: string;
  appName: string;
  reporter: string;
  reason: string;
  details?: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface GothwadUser {
  id: string;
  username: string;
  name: string;
  email: string;
  picture?: string;
}

export interface Category {
  slug: string;
  name: string;
  kind: 'app' | 'game' | 'both';
  icon: string;
}
