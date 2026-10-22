# 🥝 KIWI_MIGRATION.md — Cloudflare D1 Migration & Domain Configuration Guide

Yeh doc `GothwadTech/store` ke **100% Zero-Card Cloudflare D1 + D1 BLOB Edge Cache**
migration aur brand/domain configuration ka reference hai.

## 1. Storage & Database Architecture (Zero-Card)

| Layer | Purana | Ab (Production) |
|-------|--------|-----------------|
| **Database** | Supabase Postgres | **Cloudflare D1** (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`) |
| **Images** | ImgBB API | **D1 `store_images` BLOB** + **Cloudflare Edge Cache (`caches.default`)** (`/api/images/:id`) |
| **APKs (≤ 50 MB)** | GitHub `GothwadTech/storefiles` | **GitHub `GothwadTech/storefiles`** (Worker proxy download `/api/download/:releaseId`) |
| **Auth / SSO** | `localStorage` Bearer token | **`.gothwadtech.com` HttpOnly SSO Cookies** + `/u/0..5` Multi-Account + Bearer fallback for Android `storeapp` |

## 2. Production Domains (4 Surfaces, 1 Pages Project + 1 Worker)

| Site | Default Host (`shared/brand.ts`) | Alternate Alias Supported |
|------|----------------------------------|---------------------------|
| 🛍️ Store | `store.gothwadtech.com` | `kiwistore.gothwadtech.com` |
| 🧑‍💻 Console | `storeconsole.gothwadtech.com` | `kiwiconsole.gothwadtech.com` |
| 🛡️ Admin | `storeadmin.gothwadtech.com` | `kiwiadmin.gothwadtech.com` |
| 📱 Store App | `storeapp.gothwadtech.com` | `kiwiapp.gothwadtech.com` |

Chaaro **one-level** subdomain hain → Cloudflare ka free **Universal SSL**
(`*.gothwadtech.com`) inhe cover kar leta hai.

## 3. Cloudflare D1 Setup & Schema

`worker/wrangler.toml` me D1 binding pehle se wired hai:
```toml
[[d1_databases]]
binding = "DB"
database_name = "store"
database_id = "a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"
```

SQL files (`sql/`):
- `sql/00_d1_console_bootstrap.sql` — 100% comment-free, `PRAGMA`-free idempotent SQL (Cloudflare D1 Console paste ke liye).
- `sql/01_store_schema.sql` — Full annotated D1 SQLite schema + 12 categories + 5 official Gothwad ecosystem apps (`wrangler d1 execute` ke liye).

## 4. Worker Secrets & Variables

- `keep_vars = true` `worker/wrangler.toml` me enabled hai taaki deploy par Cloudflare Dashboard variables delete na hon.
- Sirf ek secret optional hai (APK uploads ke liye):
  ```bash
  npx wrangler secret put GITHUB_TOKEN --config worker/wrangler.toml
  ```
  (`GITHUB_FILES_TOKEN` alias bhi supported hai).
- Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) aur ImgBB (`IMGBB_API_KEY`) poori tarah hata diye gaye hain.

## 5. Future me naam/domain badalna ho (code touch kiye bina)

| Kya badalna hai | Pages (Environment variables) | Worker (Variables / `wrangler.toml`) |
|-----------------|------------------------------|--------------------------------------|
| Sirf app ka naam | `VITE_APP_NAME`, `VITE_APP_SHORT_NAME` | `APP_NAME`, `APP_SHORT_NAME` |
| Poora zone (sabhi sites) | `VITE_APP_DOMAIN` | `APP_DOMAIN` |
| Ek site ka subdomain | `VITE_CONSOLE_HOST` (etc.) | `CONSOLE_HOST` (etc.) |
| Ek site ka poora URL (dusra zone) | `VITE_CONSOLE_URL` (etc.) | `CONSOLE_URL` (etc.) |
| Store Android app ka package | `VITE_STOREAPP_PACKAGE` | `STOREAPP_PACKAGE` |
| Accounts ka URL/client_id | `VITE_ACCOUNTS_SIGNIN_URL`, `VITE_ACCOUNTS_API_URL`, `VITE_OAUTH_CLIENT_ID` | `AUTH_SIGNIN_URL`, `AUTH_HUB_URL`, `OAUTH_CLIENT_ID` |

Defaults sirf **`shared/brand.ts`** me hain; browser (`src/lib/config.ts`), build
(`vite.config.ts` → `index.html` tokens + `manifest.json`) aur Worker
(`worker/src/index.ts`) teeno wahi se padhte hain.
