# 📐 ARCHITECTURE & SPECIFICATION — Kiwi Store (`GothwadTech/store`)

This document specifies the system architecture, decoupled startup model, Cloudflare D1 schema, API surface, authentication model, and storage design for **Kiwi Store**.

---

## 1. Multi-Surface Topology

All four web domains are served from a single Vite + React 19 build (`src/`) and share one Cloudflare Worker API (`worker/`) mounted on `/api/*`:

| Surface | Production Host | Mode ID | Description |
|---|---|---|---|
| **Kiwi Store** | `kiwistore.gothwadtech.com` | `store` | Consumer app & game catalog, F-Droid open-source catalog, search, reviews, library, wishlist |
| **Kiwi Console** | `kiwiconsole.gothwadtech.com` | `console` | Developer registration, app management, APK & WebP uploads, release submissions, stats |
| **Kiwi Admin** | `kiwiadmin.gothwadtech.com` | `admin` | Release moderation queue, app suspension/restoration, abuse report resolution |
| **Kiwi Store App** | `kiwiapp.gothwadtech.com` | `storeapp` | Download landing page for the native Android client (`com.gothwad.store`) |

In `worker/wrangler.toml`, active custom domain routes bind `/api/*` across all four hosts to the `kiwi-store-api` Worker on `zone_name = "gothwadtech.com"`.

---

## 2. Decoupled Startup & Readiness Architecture

Startup is separated into four independent state tracks in `src/lib/AppContext.tsx` and `src/lib/sessionClient.ts`:

1. **Identity Track (`authStatus`: `'loading' | 'authenticated' | 'anonymous' | 'unavailable'`)**:
   - Store, Admin, and StoreApp call `GET /api/me?light=1` (also exposed at `GET /api/auth/session`), which verifies the session with Gothwad Accounts and computes server-side `isAdmin` without blocking on D1 schema bootstrap or developer lookup (`developerStatus: 'deferred'`).
   - Console calls `GET /api/me`, where D1 developer lookup is wrapped in `try/catch` so D1 outages still return `200` with verified `user`, `isAdmin`, and `developerStatus: 'unavailable'`.
   - Concurrent calls for the same `authuser` selector and auth generation share a single in-flight promise (`resolveSessionState`).
2. **Catalog Track (`catalogStatus`: `'loading' | 'ready' | 'unconfigured' | 'unavailable'`)**:
   - Runs concurrently with identity (`fetchCatalog()` -> `GET /api/store/apps?fdroid=1` + `GET /api/store/categories`).
   - Public Store catalog renders immediately when catalog resolves, even if identity verification is still pending or anonymous.
3. **Authorization Track (`permissionsStatus`: `'loading' | 'ready' | 'unavailable'`)**:
   - All admin and developer authorization remains strictly on the Cloudflare Worker (`requireUser`, `requireDeveloper`, `requireAdmin`).
   - If the Store Worker is unreachable (`502`/network) and direct Accounts fallback (`GET https://accounts.gothwadtech.com/api/auth/accounts`) verifies identity, `user` is preserved while `permissionsStatus` and `developerStatus` are marked `'unavailable'` (`isAdmin: null`), preventing false "Admin access required" or false `<Onboarding />` states.
4. **Surface-Specific Private Data Track (`libraryStatus`, `developerStatus`, `adminStatus`)**:
   - Store fetches only `GET /api/store/library` + `GET /api/store/wishlist` after authentication.
   - Console fetches `GET /api/dev/apps` (`devApi.bundle`) only on the Console surface.
   - Admin fetches `GET /api/admin/apps`, `GET /api/admin/queue`, and `GET /api/admin/reports` only on the Admin surface after `permissionsStatus === 'ready' && isAdmin === true`.

---

## 3. Zero-Card Storage Architecture

1. **Cloudflare D1 (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`)**:
   - Stores all relational data across 13 SQLite tables (`categories`, `developers`, `apps`, `app_screenshots`, `releases`, `submissions`, `reviews`, `wishlists`, `library`, `reports`, `download_events`, `store_images`, `audit_logs`).
2. **D1 `store_images` BLOB + Cloudflare Edge Cache (`caches.default`)**:
   - Browser Canvas compresses uploaded icons, screenshots, and banners to `<= 380 KB` WebP (`src/lib/imageUpload.ts`).
   - Worker (`POST /api/uploads/image`) verifies magic bytes (`RIFF..WEBP`, `PNG`, `JPEG`), computes SHA-256 for deduplication, stores bytes in `store_images`, and serves `GET /api/images/:id` with `Cache-Control: public, max-age=31536000, immutable` and `ETag`.
3. **GitHub Releases (`GothwadTech/storefiles`)**:
   - Stores developer APK binaries (`<= 50 MB`) under release tag `apk-storage`.
4. **F-Droid Open Source Integration (`worker/src/fdroid.ts`)**:
   - Combines a curated 20-app FOSS seed catalog (`worker/src/fdroid-data.ts`) with live Edge-cached F-Droid search (`search.f-droid.org`) and package metadata (`f-droid.org/api/v1/packages/<pkg>`).

---

## 4. Multi-Account SSO & Security Invariants

1. **No Redundant Fallback on Authoritative Anonymous Responses**:
   - When `/api/me` returns `401 { error: "unauthorized" }` or `200 { authenticated: false }`, the client resolves immediately as `anonymous` without calling `accounts.gothwadtech.com`.
2. **Generation-Guarded Account Switching & Sign-Out**:
   - `switchAccount` awaits `POST /api/auth/switch` before mutating URL `/u/<authuser>` or active identity.
   - `bumpAuthGeneration()` + `clearInflightSessions()` + `clearPrivateState()` ensure stale responses from a previous account or signed-out session are discarded.
3. **Safe Redirects & Cookie Forwarding**:
   - `sanitizeNextUrl` allows only relative paths and `gothwadtech.com` / `*.gothwadtech.com` HTTPS URLs.
   - Worker auth endpoints forward every rotated `Set-Cookie` header individually via `appendSetCookies` and set `Cache-Control: no-store` on all JSON responses.
