import { brandFor } from './http';
import { mapApp, mapRelease, mapReview, num, str } from './mappers';
import type { AuthUser, D1Database, Env, Row } from './types';

const initializedDbs = new WeakSet<object>();

export function hasD1(env: Env): env is Env & { DB: D1Database } {
  return Boolean(env.DB && typeof env.DB.prepare === 'function');
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS developers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    org_name TEXT NOT NULL DEFAULT '',
    support_email TEXT NOT NULL DEFAULT '',
    website TEXT,
    logo_url TEXT,
    is_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_developers_user_id ON developers (user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_developers_username ON developers (username)`,
  `CREATE TABLE IF NOT EXISTS categories (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'both' CHECK (kind IN ('app', 'game', 'both')),
    icon TEXT NOT NULL DEFAULT 'LayoutGrid'
  )`,
  `CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL REFERENCES categories(slug),
    kind TEXT NOT NULL DEFAULT 'app' CHECK (kind IN ('app', 'game')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published', 'unlisted', 'suspended')),
    short_desc TEXT NOT NULL DEFAULT '',
    full_desc TEXT NOT NULL DEFAULT '',
    icon_url TEXT NOT NULL DEFAULT '',
    icon_color TEXT NOT NULL DEFAULT '#2f7d4f',
    feature_graphic_url TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    support_email TEXT NOT NULL DEFAULT '',
    website TEXT,
    privacy_policy_url TEXT,
    rating_avg REAL NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    downloads_count INTEGER NOT NULL DEFAULT 0,
    featured TEXT CHECK (featured IN ('hero', 'editors', 'top_new')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_apps_status ON apps (status)`,
  `CREATE INDEX IF NOT EXISTS idx_apps_category ON apps (category)`,
  `CREATE INDEX IF NOT EXISTS idx_apps_developer ON apps (developer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_apps_downloads ON apps (downloads_count DESC)`,
  `CREATE TABLE IF NOT EXISTS app_releases (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version_code INTEGER NOT NULL,
    version_name TEXT NOT NULL,
    apk_provider TEXT NOT NULL DEFAULT 'github' CHECK (apk_provider IN ('github')),
    apk_key TEXT NOT NULL DEFAULT '',
    apk_url TEXT NOT NULL DEFAULT '',
    apk_size_bytes INTEGER NOT NULL DEFAULT 0,
    apk_sha256 TEXT,
    min_sdk INTEGER,
    target_sdk INTEGER,
    permissions TEXT NOT NULL DEFAULT '[]',
    changelog TEXT NOT NULL DEFAULT '',
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    review_note TEXT,
    is_live INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (app_id, version_code)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_releases_app ON app_releases (app_id, version_code DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_releases_live ON app_releases (app_id, is_live)`,
  `CREATE TABLE IF NOT EXISTS app_screenshots (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'd1',
    sort_order INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'phone'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_screenshots_app ON app_screenshots (app_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT NOT NULL DEFAULT '',
    developer_reply TEXT,
    developer_reply_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (app_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_app ON reviews (app_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS wishlists (
    user_id TEXT NOT NULL,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (user_id, app_id)
  )`,
  `CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    release_id TEXT REFERENCES app_releases(id) ON DELETE SET NULL,
    user_id TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_downloads_app_created ON downloads (app_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_downloads_ip_hash ON downloads (ip_hash)`,
  `CREATE TABLE IF NOT EXISTS library (
    user_id TEXT NOT NULL,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    first_downloaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_version_code INTEGER,
    PRIMARY KEY (user_id, app_id)
  )`,
  `CREATE TABLE IF NOT EXISTS review_submissions (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    release_id TEXT NOT NULL REFERENCES app_releases(id) ON DELETE CASCADE,
    submitted_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_username TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    decided_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_status ON review_submissions (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    reporter_user_id TEXT NOT NULL,
    reporter_username TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS featured (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('hero', 'editors_choice', 'top_new')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT,
    ends_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS store_images (
    id TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL UNIQUE,
    owner_username TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'screenshot' CHECK (kind IN ('icon', 'screenshot', 'banner')),
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/webp', 'image/png', 'image/jpeg')),
    byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 400000),
    width INTEGER,
    height INTEGER,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_store_images_owner ON store_images (owner_username)`,
  `INSERT INTO categories (slug, name, kind, icon) VALUES
    ('communication', 'Communication', 'both', 'MessageCircle'),
    ('tools', 'Tools & Utilities', 'app', 'Wrench'),
    ('browser', 'Browsers', 'app', 'Globe'),
    ('productivity', 'Productivity', 'app', 'CheckSquare'),
    ('education', 'Education', 'app', 'GraduationCap'),
    ('entertainment', 'Entertainment', 'both', 'PlayCircle'),
    ('music', 'Music & Audio', 'app', 'Music'),
    ('photo', 'Photography', 'app', 'Camera'),
    ('games-action', 'Action Games', 'game', 'Swords'),
    ('games-puzzle', 'Puzzle Games', 'game', 'Puzzle'),
    ('games-racing', 'Racing Games', 'game', 'Car'),
    ('finance', 'Finance', 'app', 'Wallet')
  ON CONFLICT (slug) DO UPDATE SET
    name = excluded.name,
    kind = excluded.kind,
    icon = excluded.icon`,
];

export async function ensureSchema(db: D1Database, env: Env = {}): Promise<void> {
  if (initializedDbs.has(db)) return;
  const brand = brandFor(env);
  const storeUrl = brand.siteUrls.store;
  const iconUrl = `${storeUrl}/assets/icon-512.png`;
  const supportEmail = `support@${brand.appDomain}`;
  const mainSite = `https://${brand.appDomain}`;

  const stmts = SCHEMA_STATEMENTS.map((sql) => db.prepare(sql));
  stmts.push(
    db
      .prepare(
        `INSERT OR IGNORE INTO developers (
          id, user_id, username, display_name, org_name, support_email, website, is_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        'dev-gothwad',
        'gothwadtech',
        'gothwadtech',
        `${brand.ecosystemName} Technologies`,
        `${brand.ecosystemName} Technologies`,
        supportEmail,
        mainSite,
      ),
  );

  const officialApps = [
    [
      'app-kiwi-store',
      brand.storeappPackage,
      brand.appName,
      'tools',
      `Official Android app store for the ${brand.ecosystemName} ecosystem with SHA-256 verified APK releases.`,
      `${brand.appName} is the official Android client for discovering, installing, and updating verified applications across the ${brand.ecosystemName} ecosystem.`,
      '#2f7d4f',
      '["store","official","gothwad","kiwi"]',
      storeUrl,
      4.9,
      24,
      1250,
      'hero',
      'rel-kiwi-store-1',
      `https://github.com/${brand.ecosystemName}Tech/storeapp/releases/latest/download/app-release.apk`,
      8945120,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ],
    [
      'app-gothwad-accounts',
      'com.gothwad.accounts',
      `${brand.ecosystemName} Accounts`,
      'tools',
      `Unified single sign-on, multi-account switcher, and security key manager for ${brand.ecosystemName} services.`,
      `Manage your ${brand.ecosystemName} identity, active sessions, OAuth 2.0 PKCE authorizations, and up to 6 simultaneous accounts.`,
      '#0ea5e9',
      '["accounts","security","sso","gothwad"]',
      brand.accountsSignInUrl,
      4.8,
      18,
      980,
      'editors',
      'rel-gothwad-accounts-1',
      brand.accountsSignInUrl,
      4521984,
      'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    ],
    [
      'app-gothwad-mail',
      'com.gothwad.mail',
      `${brand.ecosystemName} Mail`,
      'communication',
      `Fast, private @${brand.appDomain} email client with multi-account inbox switching.`,
      `Send and receive email on your @${brand.appDomain} address with instant delivery and multi-account switching.`,
      '#6366f1',
      '["mail","email","communication","gothwad"]',
      mainSite,
      4.8,
      15,
      840,
      'editors',
      'rel-gothwad-mail-1',
      mainSite,
      6184960,
      'b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef012',
    ],
    [
      'app-gothwad-chat',
      'com.gothwad.chat',
      `${brand.ecosystemName} Chat`,
      'communication',
      `Real-time messaging and team channels powered by your ${brand.ecosystemName} identity.`,
      `Connect instantaneously with @${brand.appDomain} users, share files securely, and collaborate across devices.`,
      '#8b5cf6',
      '["chat","messaging","gothwad"]',
      mainSite,
      4.7,
      12,
      620,
      'top_new',
      'rel-gothwad-chat-1',
      mainSite,
      5412864,
      'c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01234',
    ],
    [
      'app-gothwad-cloud',
      'com.gothwad.cloud',
      `${brand.ecosystemName} Cloud`,
      'productivity',
      `Encrypted document workspace and cloud drive for the ${brand.ecosystemName} ecosystem.`,
      `Back up photos, APK builds, and workspace documents with zero-trust access controls.`,
      '#14b8a6',
      '["cloud","drive","productivity","gothwad"]',
      mainSite,
      4.8,
      14,
      710,
      'top_new',
      'rel-gothwad-cloud-1',
      mainSite,
      5898240,
      'd4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456',
    ],
  ] as const;

  for (const a of officialApps) {
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO apps (
            id, developer_id, package_name, name, category, kind, status,
            short_desc, full_desc, icon_url, icon_color, tags,
            support_email, website, privacy_policy_url,
            rating_avg, rating_count, downloads_count, featured
          ) VALUES (?, 'dev-gothwad', ?, ?, ?, 'app', 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(a[0], a[1], a[2], a[3], a[4], a[5], iconUrl, a[6], a[7], supportEmail, a[8], `${a[8]}/privacy`, a[9], a[10], a[11], a[12]),
      db
        .prepare(
          `INSERT OR IGNORE INTO app_releases (
            id, app_id, version_code, version_name, apk_provider,
            apk_key, apk_url, apk_size_bytes, apk_sha256, min_sdk, target_sdk,
            permissions, changelog, review_status, review_note, is_live, downloads
          ) VALUES (?, ?, 1, '1.0.0', 'github', ?, ?, ?, ?, 26, 35, '["android.permission.INTERNET"]', ?, 'approved', 'Verified first-party release', 1, ?)`,
        )
        .bind(a[13], a[0], `${a[1]}@1/app-release.apk`, a[14], a[15], a[16], `Initial production release of ${a[2]}.`, a[11]),
    );
  }

  await db.batch(stmts);
  initializedDbs.add(db);
}

export async function getDeveloperForUser(db: D1Database, user: AuthUser): Promise<Row | null> {
  return db
    .prepare('SELECT * FROM developers WHERE user_id = ? OR LOWER(username) = ? LIMIT 1')
    .bind(user.id, user.username.toLowerCase())
    .first<Row>();
}

export async function findApp(db: D1Database, idOrPackage: string): Promise<Row | null> {
  return db
    .prepare('SELECT * FROM apps WHERE id = ? OR package_name = ? LIMIT 1')
    .bind(idOrPackage, idOrPackage)
    .first<Row>();
}

export async function bundleApps(db: D1Database, appRows: Row[]) {
  if (appRows.length === 0) return { apps: [], releases: [], reviews: [] };
  const ids = appRows.map((a) => str(a.id));
  const idPlaceholders = ids.map(() => '?').join(', ');
  const devIds = [...new Set(appRows.map((a) => str(a.developer_id)).filter(Boolean))];
  const devPlaceholders = devIds.map(() => '?').join(', ');

  const [shotsRes, relsRes, revsRes, devsRes] = await Promise.all([
    db
      .prepare(`SELECT * FROM app_screenshots WHERE app_id IN (${idPlaceholders}) ORDER BY sort_order ASC`)
      .bind(...ids)
      .all<Row>(),
    db
      .prepare(
        `SELECT * FROM app_releases WHERE app_id IN (${idPlaceholders}) AND is_live = 1 ORDER BY version_code DESC`,
      )
      .bind(...ids)
      .all<Row>(),
    db
      .prepare(`SELECT * FROM reviews WHERE app_id IN (${idPlaceholders}) ORDER BY created_at DESC`)
      .bind(...ids)
      .all<Row>(),
    devIds.length > 0
      ? db
          .prepare(`SELECT * FROM developers WHERE id IN (${devPlaceholders})`)
          .bind(...devIds)
          .all<Row>()
      : Promise.resolve({ results: [] as Row[], success: true }),
  ]);

  const devById = new Map(devsRes.results.map((d) => [str(d.id), d]));
  const shotsByApp = new Map<string, string[]>();
  for (const s of shotsRes.results) {
    const list = shotsByApp.get(str(s.app_id)) ?? [];
    list.push(str(s.url));
    shotsByApp.set(str(s.app_id), list);
  }

  return {
    apps: appRows.map((a) =>
      mapApp(a, devById.get(str(a.developer_id)), shotsByApp.get(str(a.id)) ?? []),
    ),
    releases: relsRes.results.map(mapRelease),
    reviews: revsRes.results.map(mapReview),
  };
}

export async function recomputeAppRating(db: D1Database, appId: string): Promise<void> {
  const { results } = await db
    .prepare('SELECT rating FROM reviews WHERE app_id = ?')
    .bind(appId)
    .all<Row>();
  const count = results.length;
  const avg = count
    ? Math.round((results.reduce((t, r) => t + num(r.rating), 0) / count) * 10) / 10
    : 0;
  await db
    .prepare('UPDATE apps SET rating_avg = ?, rating_count = ?, updated_at = ? WHERE id = ?')
    .bind(avg, count, new Date().toISOString(), appId)
    .run();
}
