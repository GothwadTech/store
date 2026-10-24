# 🤝 HANDOVER — Kiwi Store (`GothwadTech/store`)

This document provides the complete technical and operational handover for the **Kiwi Store** web and API monorepo.

---

## 1. Platform Overview

Kiwi Store is the Android app distribution platform for the **Gothwad** ecosystem. Both official Gothwad apps and third-party developer apps are published through Kiwi Console, reviewed in Kiwi Admin, and distributed alongside open-source F-Droid packages.

### Four Web Surfaces + Shared Worker API
1. **Kiwi Store (`https://kiwistore.gothwadtech.com`)** — Public store for browsing, searching, reviewing, and downloading Android APKs (both first-party/developer D1 apps and F-Droid open-source apps).
2. **Kiwi Console (`https://kiwiconsole.gothwadtech.com`)** — Self-serve developer portal for registering a developer profile, creating apps, inspecting and uploading APKs, uploading WebP icons/screenshots/banners, replying to reviews, and viewing download analytics.
3. **Kiwi Admin (`https://kiwiadmin.gothwadtech.com`)** — Moderation dashboard for reviewing pending APK submissions, approving or rejecting releases, suspending or restoring apps, and resolving abuse reports.
4. **Kiwi Store App (`https://kiwiapp.gothwadtech.com`)** — Download landing page for the native Android client (`com.gothwad.store`, hosted in [`GothwadTech/storeapp`](https://github.com/GothwadTech/storeapp)).

---

## 2. Non-Negotiable Architecture Guardrails

1. **100% Zero-Card Storage**:
   - **Database**: Cloudflare D1 (`binding = "DB"`, `database_name = "store"`, `database_id = "a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"`). Zero Supabase, zero R2, zero paid databases.
   - **Images (Icons, Screenshots, Banners)**: Client browser compresses images via Canvas to `<= 380 KB` WebP (`src/lib/imageUpload.ts`). The Worker (`worker/src/routes/media.ts`) verifies binary magic bytes (`RIFF..WEBP`, `PNG`, `JPEG`), deduplicates by SHA-256, and stores them in D1 `store_images`.
   - **Image CDN**: `GET /api/images/:id` serves image blobs through Cloudflare Edge Cache (`caches.default`) with `Cache-Control: public, max-age=31536000, immutable` and `ETag` (`304 Not Modified`), returning canonical URLs on `https://kiwistore.gothwadtech.com/api/images/<id>?v=<sha256_prefix>`.
   - **APKs (`<= 50 MB`)**: Stored on GitHub Releases in `GothwadTech/storefiles` (plus official F-Droid CDN for `fdroid:<packageName>` items).
2. **Decoupled Identity, Authorization, Catalog, and Surface Data Readiness**:
   - Public Store catalog and identity verification run independently in parallel.
   - `GET /api/auth/session` and `GET /api/me?light=1` return verified Accounts identity + server-derived `isAdmin` + multi-account slots immediately without blocking on D1 `ensureSchema` or developer profile queries.
   - Verified identity is never treated as proof of developer or admin access: protected routes remain guarded until Worker-derived permissions are known, and `unavailable` permissions/workspace states show retry controls rather than false "Admin access required" or false `<Onboarding />` screens.
   - Only confirmed `anonymous` identity may prompt or redirect to `https://accounts.gothwadtech.com/signin?next=...`; `429`, `5xx`, network errors, and HTML responses resolve as `unavailable` with retry UI.
3. **`<= 500` Lines Per File**:
   - Every `.ts`, `.tsx`, `.mjs`, `.sql`, and `.md` file in the repository must remain `<= 500` lines, enforced automatically by `tests/filesize-and-integrity.test.mjs`.
4. **D1 SQL Hygiene**:
   - Never include `PRAGMA` statements in runtime Worker SQL or `sql/00_d1_console_bootstrap.sql`.
   - Keep `sql/00_d1_console_bootstrap.sql` free of SQL comments (`--` or `/* */`) so it can be pasted directly into the Cloudflare D1 Console.
5. **Silent `.gothwadtech.com` SSO, Generation Safety & Zero Web Token Storage**:
   - Never store web `access_token` or `refresh_token` in `localStorage`, `sessionStorage`, or private service-worker caches; all authenticated/private Worker responses set `Cache-Control: no-store`.
   - Account switch (`switchAccount`) awaits `POST /api/auth/switch` before mutating URL or active identity, increments the auth generation counter (`bumpAuthGeneration`), aborts in-flight requests, and clears private state so Account-A responses never leak into Account-B.
6. **No Demo Data on Production Hosts**:
   - On `gothwadtech.com` and any `*.gothwadtech.com` subdomain, `isDemoModeAllowed()` is `false` and `DEMO_USER` is never exposed.

---

## 3. Repository Layout

- `shared/brand.ts` — Single source of truth for brand names, domains, and surface URLs.
- `sql/` — `00_d1_console_bootstrap.sql`, `01_store_schema.sql`, and `sql/README.md`.
- `tools/local-d1.mjs` — Local Cloudflare D1 simulator built on `node:sqlite` (`DatabaseSync`).
- `worker/` — Modular Cloudflare Worker API (`index.ts`, `types.ts`, `http.ts`, `db.ts`, `mappers.ts`, `auth.ts`, `fdroid-data.ts`, `fdroid.ts`, `routes/store-public.ts`, `routes/store-user.ts`, `routes/media.ts`, `routes/console.ts`, `routes/admin.ts`).
- `src/` — React 19 + TypeScript + Tailwind CSS v4 frontend (`lib/auth.ts`, `lib/authuser.ts`, `lib/sessionClient.ts`, `lib/api.ts`, `lib/appState.ts`, `lib/AppContext.tsx`, `shared/`, `store/`, `console/`, `admin/`, `landing/`).
- `tests/` — Automated unit, integration, F-Droid, SSO, startup/resilience, file-size, and JSDOM UI smoke tests.
