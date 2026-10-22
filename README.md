# 🥝 Kiwi Store — Gothwad Android App Store Ecosystem

A single codebase powering all **4 web surfaces** of the Kiwi Store platform (`src/`) plus the **Cloudflare D1 + Edge Cache Worker API** (`worker/`):

| Surface | Default Domain | Purpose |
|---|---|---|
| **Kiwi Store** | `https://kiwistore.gothwadtech.com` | Public Android app & game store (Kiwi Store D1 + F-Droid Open Source catalog, search, details, reviews, library, wishlist, direct APK downloads) |
| **Kiwi Console** | `https://kiwiconsole.gothwadtech.com` | Developer portal (free registration, app creation, APK upload to GitHub Releases with auto-manifest inspection, D1 + Edge Cache WebP image uploads, review replies, analytics) |
| **Kiwi Admin** | `https://kiwiadmin.gothwadtech.com` | Moderation dashboard (manual APK review queue, approve/reject, suspend/restore, abuse reports) |
| **Kiwi Store App** | `https://kiwiapp.gothwadtech.com` | Landing page to download the native Kiwi Store Android client APK (`com.gothwad.store`) |

The native Android client lives in [`GothwadTech/storeapp`](https://github.com/GothwadTech/storeapp) and communicates with this same Worker API (`/api/*`).

> **Brand names and domains are never hardcoded in components.** All defaults live in `shared/brand.ts` and can be overridden via environment variables (`VITE_APP_NAME`, `VITE_APP_DOMAIN`, `APP_NAME`, `APP_DOMAIN`, `*_HOST`).

---

## 📚 Documentation

| File | Description |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Step-by-step Cloudflare D1, Worker, and Pages deployment guide |
| [`docs/KIWI_MIGRATION.md`](docs/KIWI_MIGRATION.md) | Domain, Cloudflare D1 binding, and Worker route configuration reference |
| [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) | Third-party developer guide for publishing Android apps on Kiwi Store |
| [`sql/README.md`](sql/README.md) | Idempotent Cloudflare D1 SQLite migrations (`00_d1_console_bootstrap.sql`, `01_store_schema.sql`) |
| [`PLAN.md`](PLAN.md) | Architecture, D1 schema, API endpoints, and security specification |
| [`TASK.md`](TASK.md) | Completed engineering milestones and verification checklist |
| [`HANDOVER.md`](HANDOVER.md) | Project handover, architecture guardrails, and operational reference |

---

## 🔐 Automatic `.gothwadtech.com` Silent SSO & Universal Account Switcher

- **Silent First-Party SSO**: Signing into `accounts.gothwadtech.com`, `mail.gothwadtech.com`, or any `*.gothwadtech.com` surface sets the shared `.gothwadtech.com` SSO cookies. Opening `kiwistore`, `kiwiconsole`, `kiwiadmin`, or `kiwiapp` automatically detects the active session via `/api/me` and direct browser fallback to `https://api.gothwadtech.com/api/auth/me` (`credentials: 'include'`).
- **First-Party Sign-In**: Clicking **Sign in** navigates directly to `https://accounts.gothwadtech.com/signin?next=<current_url>` with zero third-party OAuth consent prompts on web, while preserving `Authorization: Bearer <token>` and `POST /api/auth/exchange` for the native Android `storeapp`.
- **Universal Account Menu (`window.GothwadAccountMenu`)**: Clicking the top-right profile avatar opens the Google-style Account Sheet (`https://accounts.gothwadtech.com/widget/account-menu.js` with offline Shadow-DOM fallback), supporting up to **6 simultaneous signed-in accounts** (`/u/0`..`/u/5`, `?authuser=N`, `X-Gothwad-Authuser`).

---

## 🛠️ Local Development

```bash
# 1. Install dependencies & run frontend + tests
npm install
npm run dev       # http://localhost:5173 (?mode=store | console | admin | storeapp)
npm run lint      # ESLint + TypeScript typecheck
npm test          # Node test suite (D1 SQLite + F-Droid + SSO + brand + upload guards)
npm run build     # Production Vite bundle -> dist/
npm run test:ui   # Headless JSDOM render smoke test across all 4 surfaces

# 2. Cloudflare Worker (API)
cd worker
npm install
cp .dev.vars.example .dev.vars
npm run dev       # http://localhost:8787
```

---

## 🗄️ Zero-Card Storage Architecture

| Asset | Storage Provider | Delivery |
|---|---|---|
| **Metadata, Catalog, Reviews, Submissions** | **Cloudflare D1** (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`) | Worker SQLite queries (`/api/store/*`, `/api/dev/*`, `/api/admin/*`) |
| **Icons, Screenshots, Banners (`<= 380 KB` WebP)** | **Cloudflare D1 `store_images` BLOB** + **Cloudflare Edge Cache (`caches.default`)** | `GET /api/images/:id` (`Cache-Control: public, max-age=31536000, immutable`, `ETag`) |
| **First-Party & Third-Party APKs (`<= 50 MB`)** | **GitHub Releases** (`GothwadTech/storefiles`) | `GET /api/download/:releaseId` (`302` redirect + download tracking) |
| **Open-Source Catalog & APKs (`fdroid:<pkg>`)** | **F-Droid Official Repository** + **Cloudflare Edge Cache (`caches.default`)** | `GET /api/store/fdroid`, `GET /api/store/apps?fdroid=1`, `GET /api/download/fdroid:<pkg>` |
