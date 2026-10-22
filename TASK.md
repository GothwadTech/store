# 📋 TASK.md — Kiwi Store live status

**Last updated:** 2026-10-22 (100% Zero-Card Cloudflare D1 + D1 BLOB Edge Cache CDN + Multi-Account SSO complete) · New session? Pehle [`HANDOVER.md`](HANDOVER.md) padho · Plan: [`PLAN.md`](PLAN.md) · Deploy: [`docs/SETUP.md`](docs/SETUP.md)

## ✅ Session 4 (2026-10-22) — 100% Zero-Card Cloudflare D1 + Edge Cache Image CDN + Multi-Account SSO

- [x] **Supabase & ImgBB poori tarah hataye (Zero-Card / Zero-R2):**
  - Cloudflare D1 (`database_name = "store"`, `database_id = "a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"`, `binding = "DB"`, `keep_vars = true`) `worker/wrangler.toml` me wired.
  - Legacy Postgres `sql/01_StoreSchema.sql` delete karke D1 SQLite migrations banaye:
    - `sql/00_d1_console_bootstrap.sql` (100% comment-free, `PRAGMA`-free idempotent SQL — Cloudflare D1 Console paste ke liye).
    - `sql/01_store_schema.sql` (13 tables + indexes + 12 categories + 5 official Gothwad ecosystem apps seed).
- [x] **D1 `store_images` BLOB + Cloudflare Edge Cache (`caches.default`) Image CDN:**
  - Browser (`src/lib/imageUpload.ts`) PNG/JPG/WebP images ko Canvas se `≤ 380 KB` WebP me compress karta hai.
  - Worker (`worker/src/routes/media.ts`) binary magic bytes (`RIFF..WEBP`, `PNG`, `JPEG`) verify karta hai, SHA-256 se deduplicate karta hai, D1 `store_images` BLOB table me save karta hai, aur canonical absolute URL `https://store.gothwadtech.com/api/images/<id>?v=<sha256_prefix>` return karta hai.
  - `GET /api/images/:id` Cloudflare `caches.default` (Edge Cache) + `Cache-Control: public, max-age=31536000, immutable` + `ETag` (`304 Not Modified`) ke saath serve hota hai.
- [x] **Modular Worker Architecture (`<= 500` lines per file):**
  - `worker/src/types.ts`, `worker/src/http.ts`, `worker/src/db.ts`, `worker/src/mappers.ts`, `worker/src/auth.ts`, `worker/src/apk.ts`, `worker/src/index.ts`
  - `worker/src/routes/store-public.ts`, `worker/src/routes/store-user.ts`, `worker/src/routes/media.ts`, `worker/src/routes/console.ts`, `worker/src/routes/admin.ts`
  - Supports both `/api/dev/*` and `/api/console/*` routes plus `/api/admin/overview`, `/api/admin/submissions/:id/(approve|reject)`, `/api/admin/apps/:id/(suspend|restore|unsuspend|feature)`, and `store_audit_log`.
- [x] **Web & Android Auth + Multi-Account SSO Fixes:**
  - `shared/brand.ts`: `accountsApiUrl = 'https://api.gothwadtech.com'` (fixes OAuth `/oauth/authorize` 404 when previously hitting `accounts.gothwadtech.com`).
  - Web uses `.gothwadtech.com` HttpOnly SSO cookies (`credentials: 'include'`) + `/u/0..5` URL prefix (`src/lib/router.ts`) + `X-Gothwad-Authuser` header forwarding (`src/lib/api.ts`) + `AccountMenu` multi-account switcher (`src/shared/AccountMenu.tsx`).
  - Worker (`worker/src/auth.ts`) forwards rotated `Set-Cookie` headers from Accounts `/api/auth/me` via `res.headers.getSetCookie()`, distinguishes Accounts `5xx`/network errors (`503`) from `401`/`403`, and supports `Authorization: Bearer <token>` for the Android `storeapp`.
  - Zero OAuth tokens stored in `localStorage` or `sessionStorage`.
  - Added `/auth/callback` route handling to `src/admin/AdminApp.tsx`.
- [x] **Strict `<= 500` Lines Per File Enforcement & Automated Test Suite:**
  - Split oversized frontend/worker/doc files into clean modules (`<= 500` lines each).
  - Created `tools/local-d1.mjs` (`node:sqlite` `DatabaseSync` D1 adapter), `tests/d1-store-api.test.mjs`, and `tests/filesize-and-integrity.test.mjs`.
  - Updated `tests/no-demo-catalog.test.mjs`, `tests/console-upload-guard.test.mjs`, and `tests/listing-save.test.mjs` to run against real SQLite (`LocalD1Database`).

## ✅ Previous Sessions Summary (Sessions 1–3)

- [x] 4-surface single SPA (`Store`, `Developer Console`, `Store Admin`, `StoreApp Landing`) with hostname auto-detection (`shared/brand.ts` + `src/lib/config.ts`).
- [x] Synchronous production host gating (`gothwadtech.com` & `*.gothwadtech.com` never show demo fixtures or demo sign-in).
- [x] Binary `AndroidManifest.xml` APK parser (`worker/src/apk.ts`) + GitHub `GothwadTech/storefiles` release uploader (`≤ 50 MB`).
- [x] Responsive UI design system (`src/shared/ui.tsx`) verified by `npm run test:ui` across 8 mobile & desktop surfaces.

## 🔜 Next Owner Dashboard Steps (`docs/SETUP.md`)

- [ ] Run `sql/00_d1_console_bootstrap.sql` in Cloudflare D1 Console (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`) or via `npx wrangler d1 execute store --remote --file=sql/01_store_schema.sql --config worker/wrangler.toml`.
- [ ] Ensure `GITHUB_TOKEN` secret is set on Worker `store` for `GothwadTech/storefiles` APK uploads.
- [ ] Deploy Worker (`npm run worker:deploy`) and verify `https://store.gothwadtech.com/api/health` returns `engine: "cloudflare-d1"` and `configured.d1: true`.
