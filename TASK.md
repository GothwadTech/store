# ✅ TASK TRACKER — Kiwi Store D1, F-Droid, Universal SSO & Fast Identity Startup

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

- [x] **Decoupled Fast Identity Startup, Surface Isolation & Failure Resilience**:
  - Added lightweight verified identity endpoints `GET /api/auth/session` and `GET /api/me?light=1` (`deferDeveloper=1`) in `worker/src/auth.ts` and `worker/src/index.ts`, returning verified user + server-derived `isAdmin` + multi-account slots with `developerStatus: 'deferred'` without blocking on D1 `ensureSchema` or `getDeveloperForUser`.
  - Wrapped D1 developer profile lookup in `handleMe` in `try/catch` so D1 failures still return `200` with verified `user`, `isAdmin`, `developer: null`, and `developerStatus: 'unavailable'`.
  - Hardened `resolveSession` on both Bearer and Cookie paths to mark `429`, `5xx`, network errors, and non-JSON/HTML `200` responses as `upstreamUnavailable: true` (`503 auth_unavailable`), and marked authoritative `401` responses so the client never fires a redundant direct-Accounts fallback call on confirmed anonymous sessions.
  - Added `src/lib/sessionClient.ts` (`resolveSessionState`, `clearInflightSessions`) with per-`authuser` and generation in-flight deduplication and distinct `authenticated`, `anonymous`, and `unavailable` states.
  - Decoupled `hydrateIdentity`, `hydrateCatalog`, `hydrateLibrary`, `hydrateDeveloper`, and `hydrateAdmin` in `src/lib/AppContext.tsx` with generation counters (`bumpAuthGeneration`) and `AbortController` cancellation so stale responses across account switch/sign-out/remounts are ignored and private state is wiped immediately on switch/sign-out.
  - Updated `StorePages.tsx`, `ConsoleApp.tsx`, `AdminApp.tsx`, and `AccountMenu.tsx` to render local skeletons and retryable `unavailable` error states, preserving verified identity when Store permissions/workspace are unavailable and never showing false "Admin access required" or false `<Onboarding />` screens.

- [x] **Universal Google-Style Account Switcher (`window.GothwadAccountMenu`) & Strict Hygiene**:
  - Preserved single-slot `onSignOutAccount(slotId, target)` (`resolveSignOutSlotId`), `+N` multi-account avatar badge, non-destructive failed account switch (`authApi.switchAccount` throws before URL/identity mutation), `sanitizeNextUrl` open-redirect protection, and `<= 500` lines per file across the entire repository.

---

## 2. Verification Commands

```bash
rm -rf node_modules && npm ci && (cd worker && npm ci)
npm run lint                                # 0 errors (TypeScript web + worker)
npm test                                    # 50/50 unit + integration tests passing
npm run build                               # Vite production bundle
npm run test:ui                             # 13/13 JSDOM render & startup tests passing
npx wrangler deploy --dry-run --config worker/wrangler.toml
```
