import type { Row } from './types';

export const str = (v: unknown, fallback = ''): string =>
  v === null || v === undefined ? fallback : String(v);

export const num = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const toBool = (v: unknown): boolean =>
  v === true || v === 1 || v === '1' || v === 'true';

export function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((item) => String(item).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function toJsonArray(v: unknown): string {
  return JSON.stringify(parseJsonArray(v));
}

export const mapCategory = (r: Row) => ({
  slug: str(r.slug || r.id),
  name: str(r.name),
  kind: str(r.kind, 'both'),
  icon: str(r.icon, 'LayoutGrid'),
});

export const mapDeveloper = (r: Row) => ({
  id: str(r.id),
  userId: str(r.user_id),
  username: str(r.username).toLowerCase(),
  displayName: str(r.display_name),
  orgName: str(r.org_name),
  supportEmail: str(r.support_email),
  website: r.website ? str(r.website) : undefined,
  logoUrl: r.logo_url ? str(r.logo_url) : undefined,
  verified: toBool(r.is_verified),
  createdAt: str(r.created_at),
});

export const mapApp = (r: Row, dev?: Row | null, screenshots: string[] = []) => ({
  id: str(r.id),
  packageName: str(r.package_name),
  name: str(r.name),
  developerId: str(r.developer_id),
  developerName: dev ? str(dev.org_name) || str(dev.display_name) : str(r.developer_name),
  developerVerified: dev ? toBool(dev.is_verified) : undefined,
  category: str(r.category || r.category_id),
  kind: str(r.kind, 'app'),
  status: str(r.status, 'draft'),
  shortDesc: str(r.short_desc),
  fullDesc: str(r.full_desc),
  iconUrl: str(r.icon_url),
  iconColor: str(r.icon_color, '#2f7d4f'),
  featureGraphicUrl: r.feature_graphic_url ? str(r.feature_graphic_url) : undefined,
  screenshots,
  tags: parseJsonArray(r.tags),
  supportEmail: str(r.support_email),
  website: r.website ? str(r.website) : undefined,
  privacyPolicyUrl: r.privacy_policy_url ? str(r.privacy_policy_url) : undefined,
  ratingAvg: num(r.rating_avg),
  ratingCount: num(r.rating_count),
  downloadsCount: num(r.downloads_count),
  featured: r.featured ? (str(r.featured) as 'hero' | 'editors' | 'top_new') : undefined,
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
});

export const mapRelease = (r: Row) => ({
  id: str(r.id),
  appId: str(r.app_id),
  versionCode: num(r.version_code),
  versionName: str(r.version_name),
  apkProvider: str(r.apk_provider, 'github'),
  apkKey: str(r.apk_key),
  apkUrl: r.apk_url ? `/api/download/${str(r.id)}` : '',
  apkSizeBytes: num(r.apk_size_bytes),
  apkSha256: r.apk_sha256 ? str(r.apk_sha256) : undefined,
  minSdk: r.min_sdk === null || r.min_sdk === undefined ? undefined : num(r.min_sdk),
  targetSdk: r.target_sdk === null || r.target_sdk === undefined ? undefined : num(r.target_sdk),
  permissions: parseJsonArray(r.permissions),
  changelog: str(r.changelog),
  reviewStatus: str(r.review_status, 'pending'),
  reviewNote: r.review_note ? str(r.review_note) : undefined,
  isLive: toBool(r.is_live),
  createdAt: str(r.created_at),
  downloads: num(r.downloads),
});

export const mapReview = (r: Row) => ({
  id: str(r.id),
  appId: str(r.app_id),
  userId: str(r.user_id),
  username: str(r.username),
  rating: num(r.rating),
  body: str(r.body),
  developerReply: r.developer_reply ? str(r.developer_reply) : undefined,
  developerReplyAt: r.developer_reply_at ? str(r.developer_reply_at) : undefined,
  createdAt: str(r.created_at),
});

export const mapSubmission = (r: Row, app?: Row | null, release?: Row | null, dev?: Row | null) => ({
  id: str(r.id),
  appId: str(r.app_id),
  releaseId: str(r.release_id),
  appName: app ? str(app.name) : '',
  packageName: app ? str(app.package_name) : '',
  developerName: dev ? str(dev.org_name) || str(dev.display_name) : '',
  versionName: release ? str(release.version_name) : '',
  versionCode: release ? num(release.version_code) : 0,
  apkProvider: release ? str(release.apk_provider, 'github') : 'github',
  apkSizeBytes: release ? num(release.apk_size_bytes) : 0,
  status: str(r.status, 'pending'),
  note: r.note ? str(r.note) : undefined,
  submittedAt: str(r.created_at),
  decidedAt: r.decided_at ? str(r.decided_at) : undefined,
  decidedBy: r.admin_username ? str(r.admin_username) : undefined,
});

export const mapReport = (r: Row, app?: Row | null) => ({
  id: str(r.id),
  appId: str(r.app_id),
  appName: app ? str(app.name) : '',
  reporter: str(r.reporter_username || r.reporter_user_id),
  reason: str(r.reason),
  details: r.details ? str(r.details) : undefined,
  status: str(r.status, 'open'),
  createdAt: str(r.created_at),
});
