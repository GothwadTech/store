# 📐 ARCHITECTURE & SPECIFICATION — Kiwi Store (`GothwadTech/store`)

This document specifies the system architecture, Cloudflare D1 schema, API surface, authentication model, and storage design for **Kiwi Store**.

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

## 2. Zero-Card Storage Architecture

1. **Cloudflare D1 (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`)**:
   - Stores all relational data across 13 SQLite tables (`categories`, `developers`, `apps`, `app_screenshots`, `releases`, `submissions`, `reviews`, `wishlists`, `library`, `reports`, `download_events`, `store_images`, `audit_logs`).
2. **D1 `store_images` BLOB + Cloudflare Edge Cache (`caches.default`)**:
   - Browser Canvas compresses uploaded icons, screenshots, and banners to `<= 380 KB` WebP (`src/lib/imageUpload.ts`).
   - Worker (`POST /api/uploads/image`) verifies magic bytes (`RIFF..WEBP`, `PNG`, `JPEG`), computes SHA-256 for deduplication, stores bytes in `store_images`, and serves `GET /api/images/:id` with `Cache-Control: public, max-age=31536000, immutable` and `ETag`.
3. **GitHub Releases (`GothwadTech/storefiles`)**:
   - Stores developer APK binaries (`<= 50 MB`) under release tag `apk-storage`.
4. **F-Droid Open Source Integration (`worker/src/fdroid.ts`)**:
   - Combines a curated 20-app FOSS seed catalog (`worker/src/fdroid-data.ts`) with live Edge-cached F-Droid search (`search.f-droid.org`) and package metadata (`f-droid.org/api/v1/packages/<pkg>`).
   - Uses virtual IDs `fdroid:<packageName>` so F-Droid apps never bloat D1 `apps` or GitHub `storefiles`, while still supporting user wishlists and install library tracking.

---

## 3. Authentication & Multi-Account SSO

1. **Silent `.gothwadtech.com` Cookie SSO (Web)**:
   - On page load, `fetchSession()` (`src/lib/api.ts`) calls `GET /api/me` (`credentials: 'include'`, `X-Gothwad-Authuser`).
   - If the local Worker route is unreachable or returns unauthenticated, the browser falls back directly to `GET https://api.gothwadtech.com/api/auth/me` (`credentials: 'include'`), hydrating the signed-in user and all signed-in slots (`0..5`) with zero clicks.
   - The Worker forwards `Set-Cookie` headers from Accounts `/api/auth/me` so slot token refreshes are preserved.
2. **Direct First-Party Sign-In (Web)**:
   - Clicking **Sign in** redirects directly to `https://accounts.gothwadtech.com/signin?next=<current_url>` without third-party OAuth consent screens.
3. **Universal Account Switcher (`window.GothwadAccountMenu`)**:
   - `src/shared/AccountMenu.tsx` loads `https://accounts.gothwadtech.com/widget/account-menu.js` (with a built-in Shadow-DOM fallback in `src/shared/gothwadAccountMenuFallback.ts`) to provide the Google-style Account Sheet across Store, Console, and Admin.
4. **Native Android Client Compatibility (`GothwadTech/storeapp`)**:
   - `POST /api/auth/exchange` and `Authorization: Bearer <token>` on `/api/*` remain active for native Android OAuth 2.0 + PKCE flows.
