# 🤖 HANDOVER.md — Naye AI / Session ke liye poora context

> **Sabse pehle yeh file padho.** Phir [`TASK.md`](TASK.md) (kya bana / kya baaki),
> [`PLAN.md`](PLAN.md) (poora design), aur [`docs/SETUP.md`](docs/SETUP.md) (deploy steps).
> Owner (**Pawan**) se baat **Hinglish** me karni hai.

---

## 1. Yeh project kya hai?

**Kiwi Store** (`GothwadTech/store`) — Gothwad ecosystem ka apna **Android App
Store** (Play Store + Play Console + Admin Review Panel + Store App landing page).
Bahar ke (third-party) developers bhi apna Gothwad Account bana kar yahan free me
apne Android apps/games publish kar sakte hain, aur har APK manual admin review
ke baad hi live hota hai.

### 4 Web Surfaces — 1 Repo, 1 Cloudflare Pages project, 1 Cloudflare Worker (`store`)

| Surface | Default Domain (`shared/brand.ts`) | Alternate Alias | Kaam |
|---------|------------------------------------|-----------------|------|
| 🛍️ **Store** | `store.gothwadtech.com` | `kiwistore.gothwadtech.com` | Browse, search, categories, charts, reviews, wishlist, library, APK download |
| 🧑‍💻 **Developer Console** | `storeconsole.gothwadtech.com` | `kiwiconsole.gothwadtech.com` | Developer onboarding, create app, store listing + screenshots, APK upload, stats, review replies |
| 🛡️ **Store Admin** | `storeadmin.gothwadtech.com` | `kiwiadmin.gothwadtech.com` | Manual review queue (approve/reject + note), suspend/restore/feature apps, abuse reports, audit log |
| 📱 **Store App Landing** | `storeapp.gothwadtech.com` | `kiwiapp.gothwadtech.com` | Official Kiwi Store Android app download page + QR code |

- Native Android client alag repo [`GothwadTech/storeapp`](https://github.com/GothwadTech/storeapp) me hai (Kotlin + Jetpack Compose) — woh bhi **isi Worker API** (`/api/store/*`, `/api/me`, `/api/download/*`) ko call karta hai.

---

## 2. Pakke Architectural Faisle (Non-Negotiable Rules)

1. **100% Zero-Card / Zero-Supabase / Zero-ImgBB / Zero-R2:**
   - **Database**: **Cloudflare D1** (`database_name = "store"`, `database_id = "a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"`, `binding = "DB"`).
   - **Images (Icons, Screenshots, Banners)**: Client browser Canvas se `≤ 380 KB` WebP banata hai (`src/lib/imageUpload.ts`), aur Worker (`worker/src/routes/media.ts`) binary magic bytes (`RIFF..WEBP`, `PNG`, `JPEG`) + SHA-256 deduplication ke saath **D1 `store_images` BLOB** table me save karta hai.
   - **Image Delivery CDN**: `GET /api/images/:id` Cloudflare **Edge Cache (`caches.default`)** + `Cache-Control: public, max-age=31536000, immutable` + `ETag` (`304 Not Modified`) se serve hota hai, aur canonical URL `https://store.gothwadtech.com/api/images/<id>?v=<sha256_prefix>` return karta hai taaki chaaro web subdomains aur Android app par bina broken link ke chale.
   - **APKs (`≤ 50 MB`)**: **GitHub Releases** (`GothwadTech/storefiles`) me store hote hain. Worker `/api/download/:releaseId` par download counter increment karke `302` redirect deta hai.
2. **Strict `<= 500` Lines Per File:**
   - Repo ki har code (`.ts`, `.tsx`, `.mjs`), SQL (`.sql`), test, aur documentation (`.md`) file `<= 500` lines honi chahiye. `tests/filesize-and-integrity.test.mjs` isko har `npm test` par check karta hai.
3. **D1 SQL Rules:**
   - Runtime Worker SQL ya `sql/00_d1_console_bootstrap.sql` me koi `PRAGMA` statement nahi hona chahiye.
   - `sql/00_d1_console_bootstrap.sql` me **zero comments** (`--` ya `/* */`) hone chahiye taaki Cloudflare D1 Console me direct paste karke run ho sake.
4. **Auth & Multi-Account SSO (`.gothwadtech.com`):**
   - Web par OAuth tokens (`access_token` / `refresh_token`) **kabhi bhi** `localStorage` ya `sessionStorage` me store nahi karne hain.
   - Primary web auth: `.gothwadtech.com` HttpOnly SSO cookies (`credentials: 'include'`) + `/u/0..5` URL prefix (`src/lib/router.ts`) + `X-Gothwad-Authuser` header (`src/lib/api.ts`).
   - Worker (`worker/src/auth.ts`) Accounts `/api/auth/me` se aane wale `Set-Cookie` headers (`res.headers.getSetCookie()`) ko browser response me forward karta hai taaki slot refresh-token rotation kabhi drop na ho.
   - Accounts `5xx` / timeout par Worker `503` return karta hai (`401` sirf genuine `401`/`403` par), taaki temporary network glitch par user sign-out na ho.
   - OAuth authorize endpoint `https://api.gothwadtech.com/oauth/authorize` (`BRAND.accountsApiUrl`) use karta hai, aur Android `storeapp` ke liye `Authorization: Bearer <token>` (`/api/oauth/userinfo`) poori tarah supported hai.
5. **Production Host Demo Gate:**
   - `gothwadtech.com` aur har `*.gothwadtech.com` subdomain par demo mode, seed apps, aur `DEMO_USER` synchronously disabled hain (`isDemoModeAllowed() === false`).

---

## 3. Repository Structure

```text
shared/
  brand.ts                     # Single source of truth for brand names, hosts & Accounts URLs
sql/
  00_d1_console_bootstrap.sql  # Pure comment-free idempotent SQL for D1 Console paste
  01_store_schema.sql          # Full annotated 13-table D1 schema + 12 categories + 5 Gothwad apps
  README.md                    # D1 migration instructions
tools/
  local-d1.mjs                 # node:sqlite DatabaseSync wrapper implementing Cloudflare D1 API
worker/
  wrangler.toml                # Worker config (D1 DB = a3dc3e71-cf89-4e0a-89d1-693fcf6f227a, keep_vars = true)
  src/
    types.ts                   # Env, D1Database, AuthUser, Row types
    http.ts                    # CORS (credentials + X-Gothwad-Authuser + Set-Cookie passthrough)
    db.ts                      # Idempotent runtime schema bootstrap + app/developer query helpers
    mappers.ts                 # D1 snake_case rows -> camelCase API models (Web + Android compatible)
    auth.ts                    # Cookie SSO (/api/auth/me) + Bearer (/api/oauth/userinfo) + multi-account routes
    apk.ts                     # Binary AndroidManifest.xml parser + SHA-256
    index.ts                   # Main Worker router
    routes/
      store-public.ts          # /api/store/categories, /apps, /home, /charts, /search, /apps/:id
      store-user.ts            # /api/store/wishlist, /library, /reviews, /report
      media.ts                 # /api/uploads/image, /api/images/:id (Edge Cache), /api/uploads/apk*, /api/download/:id
      console.ts               # /api/dev/* & /api/console/* developer lifecycle routes
      admin.ts                 # /api/admin/* review queue, approve/reject, suspend/restore/feature, reports, audit log
src/
  types.ts                     # Shared frontend TypeScript models + AccountSlotItem
  lib/
    config.ts                  # Brand/host resolution + production demo gate
    router.ts                  # SPA router with /u/0..5 multi-account prefix support
    auth.ts                    # Cookie-first sign-in, OAuth PKCE fallback, multi-account URLs
    imageUpload.ts             # Client-side Canvas -> WebP (<= 380 KB) optimizer
    storage.ts                 # APK size/name validators + formatting helpers
    api.ts                     # Fetch + XHR client with credentials: 'include' & X-Gothwad-Authuser
    appState.ts                # State merge & local preview helpers
    AppContext.tsx             # Global state provider (catalog, session, multi-account slots, CRUD actions)
  shared/
    ui.tsx                     # Shared design system primitives
    AccountMenu.tsx            # Multi-account profile menu (/u/0..5 switcher + Add account + Sign out)
    BackendNotice.tsx          # Production/preview status banner
  store/
    StoreApp.tsx               # Public store shell + App detail page
    StorePages.tsx             # Home, Category/Chart list, Search, Library, OAuth callback pages
  console/
    ConsoleApp.tsx             # Console root + Stats, Reviews, Settings pages
    ConsoleShell.tsx           # Sidebar/drawer shell, Onboarding, Dashboard, CreateApp
    ConsoleAppDetail.tsx       # Listing editor, D1 image upload, APK upload/preflight, Release history
  admin/
    AdminApp.tsx               # Admin moderation queue, all apps, user reports
  landing/
    StoreAppLanding.tsx        # Android app download page + QR code
tests/
  d1-store-api.test.mjs        # Full E2E D1 SQLite test suite (catalog, SSO, images+cache, console, admin)
  filesize-and-integrity.test.mjs # <= 500 lines check, D1 config check, zero Supabase/ImgBB/R2/PRAGMA check
  no-demo-catalog.test.mjs     # Production host demo gate & download protection tests
  console-upload-guard.test.mjs# D1 empty-string listing save & 50 MB GitHub APK guard tests
  listing-save.test.mjs        # Listing status transition guard tests
  brand-config.test.mjs        # Brand/domain config tests
  apk-manifest.test.mjs        # Binary APK manifest parser tests
```

---

## 4. Verification Commands

Har change ke baad yeh chaaro commands green honi chahiye:

```bash
npm run lint      # Frontend + Worker TypeScript check
npm test          # Node test runner (all D1 SQLite, SSO, Image CDN, and integrity tests)
npm run build     # Vite production build
npm run test:ui   # JSDOM render smoke test across all 8 mobile/desktop surfaces
```
