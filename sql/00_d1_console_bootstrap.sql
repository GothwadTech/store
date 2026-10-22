CREATE TABLE IF NOT EXISTS developers (
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
);

CREATE INDEX IF NOT EXISTS idx_developers_user_id ON developers (user_id);
CREATE INDEX IF NOT EXISTS idx_developers_username ON developers (username);

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'both' CHECK (kind IN ('app', 'game', 'both')),
  icon TEXT NOT NULL DEFAULT 'LayoutGrid'
);

CREATE TABLE IF NOT EXISTS apps (
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
);

CREATE INDEX IF NOT EXISTS idx_apps_status ON apps (status);
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps (category);
CREATE INDEX IF NOT EXISTS idx_apps_developer ON apps (developer_id);
CREATE INDEX IF NOT EXISTS idx_apps_downloads ON apps (downloads_count DESC);

CREATE TABLE IF NOT EXISTS app_releases (
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
);

CREATE INDEX IF NOT EXISTS idx_releases_app ON app_releases (app_id, version_code DESC);
CREATE INDEX IF NOT EXISTS idx_releases_live ON app_releases (app_id, is_live);

CREATE TABLE IF NOT EXISTS app_screenshots (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'd1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'phone'
);

CREATE INDEX IF NOT EXISTS idx_screenshots_app ON app_screenshots (app_id, sort_order);

CREATE TABLE IF NOT EXISTS reviews (
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
);

CREATE INDEX IF NOT EXISTS idx_reviews_app ON reviews (app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wishlists (
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, app_id)
);

CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  release_id TEXT REFERENCES app_releases(id) ON DELETE SET NULL,
  user_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_downloads_app_created ON downloads (app_id, created_at);
CREATE INDEX IF NOT EXISTS idx_downloads_ip_hash ON downloads (ip_hash);

CREATE TABLE IF NOT EXISTS library (
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  first_downloaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_version_code INTEGER,
  PRIMARY KEY (user_id, app_id)
);

CREATE TABLE IF NOT EXISTS review_submissions (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES app_releases(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_username TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON review_submissions (status, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL,
  reporter_username TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS store_audit_log (
  id TEXT PRIMARY KEY,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON store_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS store_images (
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
);

CREATE INDEX IF NOT EXISTS idx_store_images_owner ON store_images (owner_username);

INSERT INTO categories (slug, name, kind, icon) VALUES
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
  icon = excluded.icon;

INSERT OR IGNORE INTO developers (
  id, user_id, username, display_name, org_name, support_email, website, is_verified
) VALUES (
  'dev-gothwad',
  'gothwadtech',
  'gothwadtech',
  'Gothwad Technologies',
  'Gothwad Technologies',
  'support@gothwadtech.com',
  'https://gothwadtech.com',
  1
);

INSERT OR IGNORE INTO apps (
  id, developer_id, package_name, name, category, kind, status,
  short_desc, full_desc, icon_url, icon_color, tags,
  support_email, website, privacy_policy_url,
  rating_avg, rating_count, downloads_count, featured
) VALUES
  (
    'app-kiwi-store',
    'dev-gothwad',
    'com.gothwad.store',
    'Kiwi Store',
    'tools',
    'app',
    'published',
    'Official Android app store for the Gothwad ecosystem with SHA-256 verified APK releases.',
    'Kiwi Store is the official Android client for discovering, installing, and updating verified applications across the Gothwad ecosystem.',
    'https://kiwistore.gothwadtech.com/assets/icon-512.png',
    '#2f7d4f',
    '["store","official","gothwad","kiwi"]',
    'support@gothwadtech.com',
    'https://kiwistore.gothwadtech.com',
    'https://kiwistore.gothwadtech.com/privacy',
    4.9,
    24,
    1250,
    'hero'
  ),
  (
    'app-gothwad-accounts',
    'dev-gothwad',
    'com.gothwad.accounts',
    'Gothwad Accounts',
    'tools',
    'app',
    'published',
    'Unified single sign-on, multi-account switcher, and security key manager for Gothwad services.',
    'Manage your Gothwad identity, active sessions, OAuth 2.0 PKCE authorizations, and up to 6 simultaneous accounts across Kiwi Store, Gothwad Mail, and Gothwad Cloud.',
    'https://kiwistore.gothwadtech.com/assets/icon-512.png',
    '#0ea5e9',
    '["accounts","security","sso","gothwad"]',
    'support@gothwadtech.com',
    'https://accounts.gothwadtech.com',
    'https://accounts.gothwadtech.com/privacy',
    4.8,
    18,
    980,
    'editors'
  ),
  (
    'app-gothwad-mail',
    'dev-gothwad',
    'com.gothwad.mail',
    'Gothwad Mail',
    'communication',
    'app',
    'published',
    'Fast, private @gothwadtech.com email client with multi-account inbox switching.',
    'Send and receive email on your @gothwadtech.com address with instant delivery, strict SPF/DKIM verification, and seamless multi-account switching.',
    'https://kiwistore.gothwadtech.com/assets/icon-512.png',
    '#6366f1',
    '["mail","email","communication","gothwad"]',
    'support@gothwadtech.com',
    'https://mail.gothwadtech.com',
    'https://mail.gothwadtech.com/privacy',
    4.8,
    15,
    840,
    'editors'
  ),
  (
    'app-gothwad-chat',
    'dev-gothwad',
    'com.gothwad.chat',
    'Gothwad Chat',
    'communication',
    'app',
    'published',
    'Real-time messaging and team channels powered by your Gothwad identity.',
    'Connect instantaneously with @gothwadtech.com users, share files securely, and collaborate across devices with low-latency sync.',
    'https://kiwistore.gothwadtech.com/assets/icon-512.png',
    '#8b5cf6',
    '["chat","messaging","gothwad"]',
    'support@gothwadtech.com',
    'https://gothwadtech.com',
    'https://gothwadtech.com/privacy',
    4.7,
    12,
    620,
    'top_new'
  ),
  (
    'app-gothwad-cloud',
    'dev-gothwad',
    'com.gothwad.cloud',
    'Gothwad Cloud',
    'productivity',
    'app',
    'published',
    'Encrypted document workspace and cloud drive for the Gothwad ecosystem.',
    'Back up photos, APK builds, and workspace documents with zero-trust access controls and instant sharing across your Gothwad devices.',
    'https://kiwistore.gothwadtech.com/assets/icon-512.png',
    '#14b8a6',
    '["cloud","drive","productivity","gothwad"]',
    'support@gothwadtech.com',
    'https://gothwadtech.com',
    'https://gothwadtech.com/privacy',
    4.8,
    14,
    710,
    'top_new'
  );

INSERT OR IGNORE INTO app_releases (
  id, app_id, version_code, version_name, apk_provider,
  apk_key, apk_url, apk_size_bytes, apk_sha256, min_sdk, target_sdk,
  permissions, changelog, review_status, review_note, is_live, downloads
) VALUES
  (
    'rel-kiwi-store-1',
    'app-kiwi-store',
    1,
    '1.0.0',
    'github',
    'com.gothwad.store@1/app-release.apk',
    'https://github.com/GothwadTech/storeapp/releases/latest/download/app-release.apk',
    8945120,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    26,
    35,
    '["android.permission.INTERNET","android.permission.REQUEST_INSTALL_PACKAGES"]',
    'Initial production release of Kiwi Store for Android with Gothwad Accounts PKCE sign-in and SHA-256 package verification.',
    'approved',
    'Verified first-party Gothwad release',
    1,
    1250
  ),
  (
    'rel-gothwad-accounts-1',
    'app-gothwad-accounts',
    1,
    '1.0.0',
    'github',
    'com.gothwad.accounts@1/app-release.apk',
    'https://accounts.gothwadtech.com',
    4521984,
    'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    26,
    35,
    '["android.permission.INTERNET"]',
    'Initial production release of Gothwad Accounts with 6-slot browser and Android session management.',
    'approved',
    'Verified first-party Gothwad release',
    1,
    980
  ),
  (
    'rel-gothwad-mail-1',
    'app-gothwad-mail',
    1,
    '1.0.0',
    'github',
    'com.gothwad.mail@1/app-release.apk',
    'https://mail.gothwadtech.com',
    6184960,
    'b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef012',
    26,
    35,
    '["android.permission.INTERNET","android.permission.POST_NOTIFICATIONS"]',
    'Initial production release of Gothwad Mail with instant D1 inbox sync and multi-account support.',
    'approved',
    'Verified first-party Gothwad release',
    1,
    840
  ),
  (
    'rel-gothwad-chat-1',
    'app-gothwad-chat',
    1,
    '1.0.0',
    'github',
    'com.gothwad.chat@1/app-release.apk',
    'https://gothwadtech.com',
    5412864,
    'c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01234',
    26,
    35,
    '["android.permission.INTERNET","android.permission.POST_NOTIFICATIONS"]',
    'Initial production release of Gothwad Chat.',
    'approved',
    'Verified first-party Gothwad release',
    1,
    620
  ),
  (
    'rel-gothwad-cloud-1',
    'app-gothwad-cloud',
    1,
    '1.0.0',
    'github',
    'com.gothwad.cloud@1/app-release.apk',
    'https://gothwadtech.com',
    5898240,
    'd4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456',
    26,
    35,
    '["android.permission.INTERNET"]',
    'Initial production release of Gothwad Cloud.',
    'approved',
    'Verified first-party Gothwad release',
    1,
    710
  );

INSERT OR IGNORE INTO app_screenshots (id, app_id, url, provider, sort_order) VALUES
  ('shot-kiwi-store-1', 'app-kiwi-store', 'https://kiwistore.gothwadtech.com/assets/icon-512.png', 'd1', 0),
  ('shot-kiwi-store-2', 'app-kiwi-store', 'https://kiwistore.gothwadtech.com/assets/icon-192.png', 'd1', 1);
