# ✅ TASK TRACKER — Kiwi Store D1, F-Droid & Universal SSO

## 1. Completed Milestones

- [x] **100% Zero-Card Cloudflare D1 Database Migration (`store`)**:
  - Replaced all legacy Supabase/PostgREST code with native Cloudflare D1 (`binding = "DB"`, `database_name = "store"`, `database_id = "a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"`, `keep_vars = true`).
  - Authored pure idempotent SQLite migrations in `sql/00_d1_console_bootstrap.sql` (zero comments, zero `PRAGMA` statements) and `sql/01_store_schema.sql` covering all 13 tables, 12 categories, and 5 official Gothwad ecosystem apps.
  - Built auto-bootstrapping `ensureSchema(env)` in `worker/src/db.ts` and a real `node:sqlite` (`DatabaseSync`) test harness in `tools/local-d1.mjs`.

- [x] **100% Zero-Card D1 + Cloudflare Edge Cache Image CDN**:
  - Removed ImgBB (`IMGBB_API_KEY`) completely.
  - Client browser (`src/lib/imageUpload.ts`) compresses PNG/JPG/WebP images via Canvas to `<= 380 KB` WebP.
  - Worker (`worker/src/routes/media.ts`) validates binary magic bytes (`RIFF..WEBP`, `PNG`, `JPEG`), deduplicates by SHA-256, stores bytes in D1 `store_images`, and serves `GET /api/images/:id` through Cloudflare `caches.default` with `Cache-Control: public, max-age=31536000, immutable` and `ETag` (`304 Not Modified`).

- [x] **F-Droid Open Source Catalog & Live Search Integration**:
  - Added `worker/src/fdroid-data.ts` (curated popular open-source Android apps & games) and `worker/src/fdroid.ts` (Edge-cached F-Droid search API + live package version metadata resolver + icon proxy fallback).
  - Wired `GET /api/store/fdroid?q=<query>`, `GET /api/store/apps?fdroid=1`, `GET /api/store/home`, `GET /api/store/charts`, `GET /api/store/search`, `GET /api/store/apps/fdroid:<pkg>`, `GET /api/download/fdroid:<pkg>`, and `GET /api/fdroid/icon/:pkg` while keeping default `GET /api/store/apps` pure D1 for Android `storeapp` compatibility.
  - Added **F-Droid Open Source** rail, source filter pills (`All Sources`, `Kiwi Store`, `F-Droid Open Source`), live F-Droid search merge, and purple `F-Droid` badges on `StoreApp.tsx` and `StorePages.tsx`.

- [x] **Automatic `.gothwadtech.com` Silent SSO & First-Party Sign-In**:
  - Activated `routes = [...]` in `worker/wrangler.toml` for `kiwistore.gothwadtech.com/api/*`, `kiwiconsole.gothwadtech.com/api/*`, `kiwiadmin.gothwadtech.com/api/*`, and `kiwiapp.gothwadtech.com/api/*` (`zone_name = "gothwadtech.com"`).
  - Added automatic direct browser silent SSO fallback (`fetchDirectAccountsSession()` -> `GET https://api.gothwadtech.com/api/auth/me` with `credentials: 'include'`) in `src/lib/auth.ts` and `src/lib/api.ts`.
  - Replaced third-party web `/oauth/authorize` consent flows and `"Sign in with Gothwad"` labels with direct first-party `"Sign in"` (`https://accounts.gothwadtech.com/signin?next=<current_url>`), while preserving `Authorization: Bearer <token>` and `POST /api/auth/exchange` for the native Android `storeapp`.

- [x] **Universal Google-Style Account Switcher (`window.GothwadAccountMenu`) & Post-Merge Hardening**:
  - Updated `src/shared/AccountMenu.tsx` and `src/shared/gothwadAccountMenuFallback.ts` to load `https://accounts.gothwadtech.com/widget/account-menu.js` (`window.GothwadAccountMenu.open(state, opts)`) with a resilient Shadow-DOM fallback for offline/local environments.
  - Fixed `onSignOutAccount` (`resolveSignOutSlotId` / `signOutAccountSlot`) so primitive slot IDs (`onSignOutAccount("b", target)`) and account objects (`onSignOutAccount({ id: "b" })`) strictly sign out only that single slot (`/api/auth/accounts/b/signout`) and never wipe all browser accounts.
  - Added Google-style `+N` multi-account badge on the header avatar trigger when `accounts.length > 1`, plus `{ id, label, href, onClick }` cross-surface actions (`Kiwi Store`, `Kiwi Console`, `Kiwi Admin`).
  - Extracted zero-React URL/slot helpers into `src/lib/authuser.ts` and pinned `"typescript": "^5.8.3"` in `package.json` so `rm -rf node_modules && npm ci && npm run lint && npm test && npm run build` succeeds cleanly.

- [x] **Strict Code Hygiene & `<= 500` Lines Per File**:
  - Every source, Worker, SQL, test, and documentation file is strictly `<= 500` lines and written in 100% pure English.

---

## 2. Verification Commands

```bash
rm -rf node_modules && npm ci
npm run lint                                # 0 errors (TypeScript web + worker)
npm test                                    # 43/43 unit + integration tests passing
npm run build                               # Vite production bundle
npm run test:ui                             # 8/8 JSDOM render smoke tests passing
(cd worker && npx wrangler deploy --dry-run) # Cloudflare Worker + D1 binding validation
```
