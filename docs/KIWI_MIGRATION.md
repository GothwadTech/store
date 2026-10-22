# 🥝 KIWI STORE — Domain, D1 & SSO Configuration Reference

This document summarizes the production domain mapping, Cloudflare D1 binding, Worker routes, and brand configuration for **Kiwi Store**.

---

## 1. Production Subdomains (`*.gothwadtech.com`)

| Surface | Production URL | Worker API Route |
|---|---|---|
| **Store** | `https://kiwistore.gothwadtech.com` | `kiwistore.gothwadtech.com/api/*` |
| **Developer Console** | `https://kiwiconsole.gothwadtech.com` | `kiwiconsole.gothwadtech.com/api/*` |
| **Admin Panel** | `https://kiwiadmin.gothwadtech.com` | `kiwiadmin.gothwadtech.com/api/*` |
| **Store App Landing** | `https://kiwiapp.gothwadtech.com` | `kiwiapp.gothwadtech.com/api/*` |

All four subdomains are single-level subdomains covered by Cloudflare Universal SSL (`*.gothwadtech.com`) and share `.gothwadtech.com` HttpOnly SSO cookies.

---

## 2. Cloudflare D1 & Worker Routes (`worker/wrangler.toml`)

```toml
name = "kiwi-store-api"
main = "src/index.ts"
compatibility_date = "2025-02-01"
keep_vars = true

routes = [
  { pattern = "kiwistore.gothwadtech.com/api/*", zone_name = "gothwadtech.com" },
  { pattern = "kiwiconsole.gothwadtech.com/api/*", zone_name = "gothwadtech.com" },
  { pattern = "kiwiadmin.gothwadtech.com/api/*", zone_name = "gothwadtech.com" },
  { pattern = "kiwiapp.gothwadtech.com/api/*", zone_name = "gothwadtech.com" }
]

[[d1_databases]]
binding = "DB"
database_name = "store"
database_id = "a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"
```

---

## 3. Environment Variables & Secrets

- `keep_vars = true` is enabled in `worker/wrangler.toml` so Cloudflare Dashboard variables are preserved across deployments.
- Optional Worker secret for APK uploads to `GothwadTech/storefiles`:
  ```bash
  cd worker
  npx wrangler secret put GITHUB_TOKEN
  ```
  (`GITHUB_FILES_TOKEN` is also supported as an alias.)
- Legacy `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `IMGBB_API_KEY` are completely removed.

---

## 4. Customizing Brand or Domain Names Without Code Changes

All defaults live in **`shared/brand.ts`** and are consumed by the browser (`src/lib/config.ts`), Vite build (`vite.config.ts`), and Worker (`worker/src/index.ts`):

| Setting | Pages Environment Variable | Worker Variable (`wrangler.toml`) |
|---|---|---|
| Store brand name | `VITE_APP_NAME=My Store` | `APP_NAME=My Store` |
| Short brand name | `VITE_APP_SHORT_NAME=My` | `APP_SHORT_NAME=My` |
| Root domain | `VITE_APP_DOMAIN=example.com` | `APP_DOMAIN=example.com` |
| Subdomain prefixes | `VITE_STORE_HOST`, `VITE_CONSOLE_HOST`, `VITE_ADMIN_HOST`, `VITE_STOREAPP_HOST` | `STORE_HOST`, `CONSOLE_HOST`, `ADMIN_HOST`, `STOREAPP_HOST` |
| Accounts URLs | `VITE_ACCOUNTS_API_URL`, `VITE_ACCOUNTS_SIGNIN_URL` | `AUTH_HUB_URL`, `AUTH_SIGNIN_URL` |
