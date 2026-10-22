# 🚀 SETUP & DEPLOYMENT GUIDE — Kiwi Store

All infrastructure runs on **Cloudflare** (D1 + Workers + Pages + Edge Cache) and **GitHub Releases** (`GothwadTech/storefiles`) with zero credit-card-gated services.

---

## 1. Cloudflare D1 Database (`store`)

The production D1 database is already created and wired in `worker/wrangler.toml`:
- **Binding**: `DB`
- **Database Name**: `store`
- **Database ID**: `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`

### Apply Schema Migrations
You can apply the schema via Wrangler CLI or by pasting `sql/00_d1_console_bootstrap.sql` into the Cloudflare Dashboard D1 Console:

```bash
cd worker
npx wrangler d1 execute store --remote --file=../sql/00_d1_console_bootstrap.sql
```

> The Worker also runs `ensureSchema()` automatically on the first `/api/*` request to verify all 13 tables, 12 categories, and 5 official Gothwad apps idempotently.

---

## 2. Gothwad Accounts Registration (`GothwadTech/accounts`)

Ensure the `kiwi-store` client and first-party `*.gothwadtech.com` origins are registered in `GothwadTech/accounts`. All `*.gothwadtech.com` origins share the `.gothwadtech.com` SSO cookies automatically and can call `https://api.gothwadtech.com/api/auth/*` with `credentials: 'include'`.

---

## 3. GitHub APK Storage Secret (`GothwadTech/storefiles`)

Create a fine-grained GitHub Personal Access Token with **Contents: Read & Write** permission on `GothwadTech/storefiles`, then configure it on the Worker:

```bash
cd worker
npx wrangler secret put GITHUB_TOKEN
```

> **Note:** No external API key is needed for images. Icons, screenshots, and banners are compressed to `<= 380 KB` WebP in the browser and stored directly in D1 `store_images` + Cloudflare Edge Cache (`caches.default`).

---

## 4. Deploy Worker & Pages

### Deploy Worker (`kiwi-store-api`)
`worker/wrangler.toml` includes active `routes = [...]` for all 4 production subdomains (`kiwistore`, `kiwiconsole`, `kiwiadmin`, `kiwiapp` `/api/*` on `zone_name = "gothwadtech.com"`):

```bash
cd worker
npm install
npm run deploy
```

### Deploy Frontend (Cloudflare Pages)
Connect `GothwadTech/store` to Cloudflare Pages:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Custom domains**:
  - `kiwistore.gothwadtech.com`
  - `kiwiconsole.gothwadtech.com`
  - `kiwiadmin.gothwadtech.com`
  - `kiwiapp.gothwadtech.com`
