# 📘 SETUP.md — Kiwi Store deploy (100% Zero-Card Cloudflare D1)

Saara deployment **Cloudflare** par hai (Zero-Card, Zero-Supabase, Zero-ImgBB,
Zero-R2). Order wahi rakho jo neeche hai.

### Local / preview demo behavior

`localhost` and non-production previews retain sample listings and the optional
`pawan` demo identity for UI/workflow testing. Demo edits persist only in that
browser; sample APKs are not real, and the preview APK action does not upload a
file. Production APK uploads use GitHub `storefiles` for signed APKs up to 50 MB,
with live byte-by-byte progress.

On the apex `gothwadtech.com` and every `*.gothwadtech.com` hostname, the app
synchronously starts with empty frontend state and hides demo sign-in, seed
listings, and the development mode switcher. Production uses Gothwad Accounts
and live Worker/API data only; backend failure does not fall back to samples.

---

## Step 1 — Cloudflare D1 Database (`store`)

1. Cloudflare Dashboard → **Workers & Pages → D1 SQL Database** → database:
   - **Name**: `store`
   - **Database ID**: `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`
   (Yeh ID `worker/wrangler.toml` me `binding = "DB"` ke saath pehle se wired hai.)
2. D1 Console me `sql/00_d1_console_bootstrap.sql` paste karke Run karo (pure
   comment-free idempotent SQL), ya CLI se chala do:
   ```bash
   npx wrangler d1 execute store --remote --file=sql/01_store_schema.sql --config worker/wrangler.toml
   ```
   (Worker `/api/*` request par khud bhi `ensureSchema()` se tables + 12 categories + 5 official Gothwad apps idempotently verify kar leta hai.)

## Step 2 — Gothwad Accounts me Store ko register karo

Accounts ke D1 database (`oauth_clients` table) me `kiwi-store` client registered
hai (`GothwadTech/accounts/sql/01_schema.sql`):
- `client_id`: `kiwi-store`
- `redirect_uris`:
  - `https://store.gothwadtech.com/auth/callback`
  - `https://storeconsole.gothwadtech.com/auth/callback`
  - `https://storeadmin.gothwadtech.com/auth/callback`
  - `https://kiwistore.gothwadtech.com/auth/callback`
  - `https://kiwiconsole.gothwadtech.com/auth/callback`
  - `https://kiwiadmin.gothwadtech.com/auth/callback`
  - `kiwistore://oauth/callback`
  - `http://localhost:3000/auth/callback`

## Step 3 — GitHub APK Storage (`GothwadTech/storefiles`)

| Provider | Kya banana hai | Kya milega |
|----------|---------------|-----------|
| **GitHub** | Public repo **`GothwadTech/storefiles`** → Settings → Developer settings → Fine-grained PAT (sirf is repo, Contents + Releases write) | `GITHUB_TOKEN` (ya legacy alias `GITHUB_FILES_TOKEN`) |

> **Note:** Images (icons, screenshots, banners) ke liye koi external API key nahi chahiye — client browser unhe `≤ 380 KB` WebP me compress karta hai aur Worker unhe seedha D1 `store_images` BLOB + Cloudflare Edge Cache (`caches.default`) me store karta hai.

## Step 4 — Cloudflare Pages (chaaro sites, ek project)

1. Workers & Pages → Create → **Pages** → is repo (`GothwadTech/store`) jodo.
2. Build: command `npm run build`, output `dist`.
   Defaults `shared/brand.ts` me hain (`Kiwi Store` + `store/storeconsole/storeadmin/storeapp.gothwadtech.com`).
3. Custom domains — **chaaro** is ek project par lagao:
   `store.gothwadtech.com` · `storeconsole.gothwadtech.com` ·
   `storeadmin.gothwadtech.com` · `storeapp.gothwadtech.com`
   Chaaro domain **one-level** subdomain hain, isiliye Cloudflare ka free
   **Universal SSL** (`*.gothwadtech.com`) chaaro ko cover kar deta hai.

## Step 5 — Cloudflare Worker `store` (API)

1. `worker/wrangler.toml` me D1 binding `DB` (`database_id = "a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"`) aur `keep_vars = true` wired hain.
2. Secret set karo (dashboard → Worker → Settings → Variables → **Secret** type, ya CLI):
   ```bash
   npx wrangler secret put GITHUB_TOKEN --config worker/wrangler.toml
   ```
3. Routes (Worker → Settings → Domains & Routes → Add route) — **chaaro**:
   `store.gothwadtech.com/api/*` · `storeconsole.gothwadtech.com/api/*` ·
   `storeadmin.gothwadtech.com/api/*` · `storeapp.gothwadtech.com/api/*`
4. Deploy: `npm run worker:deploy`.
5. Check: `https://store.gothwadtech.com/api/health` →
   `engine: "cloudflare-d1"` aur `configured.d1: true` aana chahiye.

## Step 6 — Pehla asli chakkar (live test)

1. `storeconsole.gothwadtech.com` → Gothwad Account se sign in → developer bano
2. Ek test app + icon/screenshots (D1 Edge CDN test) + signed APK (≤50MB — GitHub upload test)
3. `storeadmin.gothwadtech.com` (`ADMIN_USERNAMES` wala username) → Approve
4. `store.gothwadtech.com` par app dikhe → Download → phone par install ✓
