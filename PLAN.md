# 📐 PLAN.md — Kiwi Store Architecture & Design Plan

**Kiwi Store** (`GothwadTech/store`) Gothwad ecosystem ka official Android App
Store platform hai. Yeh document platform ke architecture, database schema,
storage tiers, auth/SSO flow, aur moderation lifecycle ka complete design
reference hai.

---

## 1. Platform Overview (4 Surfaces, 1 Repo, 1 Pages Project, 1 Worker)

| Surface | Default Host | Target Audience | Core Capabilities |
|---------|--------------|-----------------|-------------------|
| **Store** | `store.gothwadtech.com` | End users (Web & PWA) | Browse Apps/Games, Top Charts, Categories, Search, App Details, Reviews, Wishlist, Library, APK Download |
| **Developer Console** | `storeconsole.gothwadtech.com` | First-party & third-party Android developers | Zero-fee registration, Create App (`com.example.app`), Store Listing editor, D1 Edge CDN image uploads, APK upload with binary manifest inspection, 7-day download stats, Review replies |
| **Store Admin** | `storeadmin.gothwadtech.com` | `ADMIN_USERNAMES` administrators | Pending submission review queue (Approve / Reject with mandatory note), Suspend / Restore / Feature apps (`hero`, `editors`, `top_new`), User abuse reports, Audit log |
| **Store App Landing** | `storeapp.gothwadtech.com` | Mobile users | Official Kiwi Store Android client (`GothwadTech/storeapp`) landing page + QR code |

---

## 2. 100% Zero-Card Storage Architecture

Platform **100% Cloudflare Free / Zero-Card** aur **GitHub Releases** par chalta
hai — koi credit-card-gated cloud storage (R2/S3) ya external database/image API
(Supabase/ImgBB) use nahi hota:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Kiwi Store Zero-Card Storage Stack                   │
├──────────────────────┬──────────────────────────────────────────────────┤
│ Relational Metadata  │ Cloudflare D1 SQLite (`store`)                   │
│                      │ database_id: a3dc3e71-cf89-4e0a-89d1-693fcf6f227a│
├──────────────────────┼──────────────────────────────────────────────────┤
│ App Icons,           │ Browser Canvas -> WebP (<= 380 KB)               │
│ Screenshots, Banners │ -> D1 `store_images` BLOB (SHA-256 deduplicated) │
│                      │ -> Cloudflare Edge Cache (`caches.default`)      │
│                      │ -> GET https://store.gothwadtech.com/api/images/ │
│                      │    (Cache-Control: public, max-age=31536000,     │
│                      │     immutable + ETag / 304 Not Modified)         │
├──────────────────────┼──────────────────────────────────────────────────┤
│ Android APK Files    │ GitHub Releases (`GothwadTech/storefiles`)       │
│ (<= 50 MB)           │ Uploaded via Worker with binary ZIP +            │
│                      │ AndroidManifest.xml verification & SHA-256       │
│                      │ Served via /api/download/:releaseId (302)        │
└──────────────────────┴──────────────────────────────────────────────────┘
```

---

## 3. Cloudflare D1 Database Schema (13 Tables)

Schema `sql/00_d1_console_bootstrap.sql` (comment-free) aur `sql/01_store_schema.sql`
me defined hai:

1. **`categories`** — 12 store categories (`tools`, `productivity`, `communication`, `social`, `media`, `education`, `finance`, `ai`, `action`, `puzzle`, `arcade`, `strategy`).
2. **`developers`** — Developer profiles (`id`, `user_id`, `username`, `display_name`, `org_name`, `support_email`, `website`, `logo_url`, `is_verified`).
3. **`apps`** — Store listings (`id`, `developer_id`, `package_name` UNIQUE, `name`, `category`, `kind`, `status`, `short_desc`, `full_desc`, `icon_url`, `icon_color`, `feature_graphic_url`, `tags` JSON array, `age_rating`, `content_notes`, `privacy_policy_url`, `support_email`, `website`, `is_featured`, `featured`, `rating_avg`, `rating_count`, `downloads_count`).
4. **`app_screenshots`** — Ordered screenshot URLs per app (`id`, `app_id`, `url`, `provider`, `sort_order`, `type`).
5. **`app_releases`** — Versioned APK releases (`id`, `app_id`, `version_code`, `version_name`, `apk_provider`, `apk_key`, `apk_url`, `apk_size_bytes`, `apk_sha256`, `min_sdk`, `target_sdk`, `abi_list`, `permissions` JSON array, `changelog`, `review_status`, `review_note`, `reviewed_by`, `reviewed_at`, `is_live`, `downloads`).
6. **`reviews`** — 1 review per `(app_id, user_id)` with `rating` (`1..5`), `title`, `body`, `developer_reply`, `developer_reply_at`. Every create/update/delete recalculates `apps.rating_avg` and `apps.rating_count` in D1.
7. **`wishlists`** — User bookmarked apps `(user_id, app_id)`.
8. **`library`** — User downloaded apps `(user_id, app_id, first_downloaded_at, last_version_code)`.
9. **`downloads`** — Daily IP-hash deduplicated download events (`app_id`, `release_id`, `user_id`, `ip_hash`, `user_agent`, `created_at`).
10. **`review_submissions`** — Developer release review queue (`id`, `app_id`, `release_id`, `submitted_by`, `status`, `reviewer`, `note`, `created_at`, `decided_at`).
11. **`reports`** — User abuse reports (`id`, `app_id`, `reporter_user_id`, `reporter_username`, `reason`, `details`, `status`, `resolved_by`, `resolved_at`).
12. **`store_images`** — Binary image storage (`id`, `sha256` UNIQUE, `owner_username`, `kind`, `mime_type`, `byte_size <= 400000`, `width`, `height`, `data` BLOB).
13. **`store_audit_log`** — Admin & developer moderation audit trail (`id`, `actor_username`, `action`, `target_type`, `target_id`, `detail_json`, `created_at`).

---

## 4. Identity, SSO & Multi-Account Architecture

1. **Web Cookie-First SSO (`.gothwadtech.com`):**
   - Browser sends `credentials: 'include'` on `/api/*` requests.
   - Worker (`worker/src/auth.ts`) forwards `Cookie` + `X-Gothwad-Authuser` (or `?authuser=0..5`) to `https://api.gothwadtech.com/api/auth/me`.
   - If Accounts rotates a slot refresh token and returns `Set-Cookie` headers, Worker forwards every `Set-Cookie` header back to the browser via `res.headers.getSetCookie()`.
   - Multi-account switcher (`src/shared/AccountMenu.tsx`) shows all signed-in slots (`0..5`), supports instant switching (`/api/auth/switch` + `/u/<n>/...` URL prefix), single-slot sign-out (`/api/auth/accounts/:id/signout`), "Add another account", and "Manage Gothwad Account".
2. **OAuth 2.0 + PKCE Fallback & Android `storeapp` Bearer Auth:**
   - Web OAuth authorize redirects to `https://api.gothwadtech.com/oauth/authorize` (`client_id = "kiwi-store"`) and exchanges the code via `POST /api/auth/exchange`.
   - Android `storeapp` authenticates via `kiwistore://oauth/callback` and sends `Authorization: Bearer <access_token>`, which Worker verifies against `https://api.gothwadtech.com/api/oauth/userinfo`.
3. **Outage Resilience:**
   - Only `401` / `403` from Accounts means signed out. Any `5xx`, network error, or malformed response returns `503` (`auth_unavailable`) so users are never falsely signed out during a brief network blip.

---

## 5. App Publishing & Moderation Lifecycle

1. **Onboarding:** Signed-in user creates a Developer profile (`POST /api/dev/register`).
2. **Draft Listing:** Developer creates an app (`POST /api/dev/apps`) with a permanent `packageName` (`com.company.app`) and completes the store listing (`PATCH /api/dev/apps/:id`) with description, icon, and at least 2 screenshots.
3. **APK Upload & Preflight:** Developer selects a signed `.apk` (`≤ 50 MB`). Worker (`worker/src/apk.ts`) parses the binary `AndroidManifest.xml` to verify `packageName`, `versionCode`, `versionName`, `minSdk`, `targetSdk`, `permissions`, and `sha256`, then uploads the asset to GitHub `GothwadTech/storefiles`.
4. **Submit for Review:** Developer creates the release (`POST /api/dev/apps/:id/releases`) and submits it (`POST /api/dev/apps/:id/releases/:releaseId/submit`). Worker verifies the listing is complete and queues a `pending` submission.
5. **Admin Decision:** Admin reviews the submission in `storeadmin.gothwadtech.com`. Approving marks the release `approved` + `is_live = 1`, demotes any older release for that app, publishes the app (`status = 'published'`), and records a `submission.approve` entry in `store_audit_log`. Rejecting requires a reviewer note shown to the developer in the Console.
