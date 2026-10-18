# 🥝 KIWI_MIGRATION.md — Gothwad Store → Kiwi Store (dashboard steps)

Code side **ho chuka hai** (is branch me). Yeh doc sirf un cheezon ka checklist hai jo
repo ke bahar hain: **Cloudflare Pages, Cloudflare Worker, Gothwad Accounts**.

### Kya NAHI badal raha (kuch mat chhedo)

| Cheez | Status |
|-------|--------|
| Pages project (`GothwadTech/store` se juda hua) | ✅ wahi rahega |
| Worker ka naam `store` | ✅ wahi rahega (rename mat karna) |
| Supabase project + `SUPABASE_URL` | ✅ wahi rahega (DB data safe) |
| Worker secrets (`SUPABASE_SERVICE_ROLE_KEY`, `IMGBB_API_KEY`, `GITHUB_FILES_TOKEN`) | ✅ wahi rahenge |
| GitHub `GothwadTech/storefiles` (APKs) | ✅ wahi rahega |
| Gothwad Accounts (`accounts.gothwadtech.com`) + ecosystem apps | ✅ naam/domain wahi |

### Domain map

| Site | Purana | Naya |
|------|--------|------|
| 🛍️ Store | `store.gothwadtech.com` | `kiwistore.gothwadtech.com` |
| 🧑‍💻 Console | `console.gothwadtech.com` | `kiwiconsole.gothwadtech.com` |
| 🛡️ Admin | `storeadmin.gothwadtech.com` | `kiwiadmin.gothwadtech.com` |
| 📱 Store App | `storeapp.gothwadtech.com` | `kiwiapp.gothwadtech.com` |

Chaaro **one-level** subdomain hain → Cloudflare ka free **Universal SSL**
(`*.gothwadtech.com`) inhe cover kar leta hai. Koi paid certificate nahi chahiye.

---

## Step 1 — Pages: naye custom domains add karo

Workers & Pages → apna **Pages project** → **Custom domains** → *Set up a custom domain*:

1. `kiwistore.gothwadtech.com`
2. `kiwiconsole.gothwadtech.com`
3. `kiwiadmin.gothwadtech.com`
4. `kiwiapp.gothwadtech.com`

Har ek par Cloudflare "Activate domain" bolega — kar do, DNS record (CNAME) wo khud
bana dega. **Purane 4 domains abhi remove mat karna** (Step 5 tak rakho, warna live
site beech me tutegi).

Env variables: zaroori nahi (defaults code me hain). Pages → **Settings → Environment
variables** me sirf tab dalo jab naam/domain badalna ho — see Step 6.

Deploy: yeh branch merge hote hi Pages auto-build karega. Build output me
`dist/manifest.json` **generate** hota hai (pehle static file thi) — usme
`"name": "Kiwi Store"` aana chahiye.

## Step 2 — Worker: naye routes + naye variables

Worker **`store`** → **Settings → Domains & Routes** → *Add route* (zone `gothwadtech.com`):

```
kiwistore.gothwadtech.com/api/*
kiwiconsole.gothwadtech.com/api/*
kiwiadmin.gothwadtech.com/api/*
kiwiapp.gothwadtech.com/api/*
```

Variables — do tarike, koi ek:

- **Aasan:** `npm run worker:deploy` — `worker/wrangler.toml` ke naye `[vars]` apply ho
  jayenge (`keep_vars = true` hai, isliye dashboard ke baki vars/secrets nahi mitte).
- **Dashboard:** Worker → Settings → Variables → *Add variable* (Text type):

| Variable | Value |
|----------|-------|
| `APP_NAME` | `Kiwi Store` |
| `APP_SHORT_NAME` | `Kiwi` |
| `ECOSYSTEM_NAME` | `Gothwad` |
| `APP_DOMAIN` | `gothwadtech.com` |
| `STORE_HOST` | `kiwistore` |
| `CONSOLE_HOST` | `kiwiconsole` |
| `ADMIN_HOST` | `kiwiadmin` |
| `STOREAPP_HOST` | `kiwiapp` |
| `OAUTH_CLIENT_ID` | `kiwi-store` |
| `STOREAPP_PACKAGE` | `com.gothwad.store` |

(`STORE_URL` / `CONSOLE_URL` / `ADMIN_URL` / `STOREAPP_URL` sirf tab chahiye jab koi
site dusre zone par ho — warna khaali chhod do.)

Check: `https://kiwistore.gothwadtech.com/api/health` → `configured` me sab `true`.

## Step 3 — Worker CORS khud theek ho jayega

Worker allowed origins ab `APP_DOMAIN` + `*_HOST` vars se bante hain (code me
hardcoded list nahi). Matlab Step 2 ke baad naye domains par sign-in/upload apne aap
chalenge. Koi extra origin chahiye ho to `ALLOWED_ORIGINS` (comma separated).

## Step 4 — Gothwad Accounts: client_id + redirect URIs

`client_id` badla hai: `gothwad-store` → **`kiwi-store`**. Accounts ke Supabase
(`ecosystem_apps` table) me row update karo:

```sql
-- redirect URIs (chaaro naye domains + local dev)
--   https://kiwistore.gothwadtech.com/auth/callback
--   https://kiwiconsole.gothwadtech.com/auth/callback
--   https://kiwiadmin.gothwadtech.com/auth/callback
--   http://localhost:3000/auth/callback
-- scopes: profile email offline_access
```

Accounts repo ka `docs/OAUTH.md` hi is kaam ka source of truth hai (column naam wahan
se confirm kar lena). Yeh step kiye bina sign-in par `redirect_uri not allowed` /
`invalid_client` aayega.

## Step 5 — Verify, phir purane domains hatao

1. Chaaro naye domains par sign-in karke dekho (cookie SSO + OAuth dono).
2. Console se ek test app submit → Admin approve → Store par dikhe → APK download.
3. `kiwiapp.gothwadtech.com` ka QR scan karke dekho (QR naye URL ka banta hai).
4. Phone par PWA: purana installed app **uninstall karke dobara Add to Home screen**
   (manifest naam cache hota hai).
5. **Database me Store ki apni listing** (agar pehle se hai) ka naam bhi badlo —
   yeh data hai, code nahi. Console se edit karo ya:
   `update public.apps set name = 'Kiwi Store' where package_name = 'com.gothwad.store';`
   (Package name wahi rahega jab tak Android app rebuild na ho — isiliye
   `STOREAPP_PACKAGE` / `VITE_STOREAPP_PACKAGE` abhi `com.gothwad.store` hai.)
6. **Old → new 301:** Cloudflare zone → **Rules → Redirect Rules** → *Create rule*,
   chaaro ke liye (example): `Hostname equals store.gothwadtech.com` →
   `https://kiwistore.gothwadtech.com${http.request.uri.path}` · 301 · query preserve.
   Isse purane bookmarks aur Google links naye domains par aa jayenge.
7. Ab Pages se purane 4 custom domains **remove** karo aur Worker se purane 4 routes.
8. Google Search Console: naye domains add karo (+ "Change of address"). Canonical/og
   tags naye domains ke saath build hote hain.

## Step 6 — Future me naam/domain badalna ho (code touch kiye bina)

| Kya badalna hai | Pages (Environment variables) | Worker (Variables / `wrangler.toml`) |
|-----------------|------------------------------|--------------------------------------|
| Sirf app ka naam | `VITE_APP_NAME`, `VITE_APP_SHORT_NAME` | `APP_NAME`, `APP_SHORT_NAME` |
| Poora zone (sabhi sites) | `VITE_APP_DOMAIN` | `APP_DOMAIN` |
| Ek site ka subdomain | `VITE_CONSOLE_HOST` (etc.) | `CONSOLE_HOST` (etc.) |
| Ek site ka poora URL (dusra zone) | `VITE_CONSOLE_URL` (etc.) | `CONSOLE_URL` (etc.) |
| Store Android app ka package | `VITE_STOREAPP_PACKAGE` | `STOREAPP_PACKAGE` |
| Accounts ka URL/client_id | `VITE_ACCOUNTS_SIGNIN_URL`, `VITE_OAUTH_CLIENT_ID` | `AUTH_SIGNIN_URL`, `AUTH_HUB_URL`, `OAUTH_CLIENT_ID` |

Uske baad zaroori dashboard kaam: Pages/Worker par naya custom domain + `…/api/*`
route, aur Accounts me redirect URI. Bas — code change nahi.

Defaults sirf **`shared/brand.ts`** me hain; browser (`src/lib/config.ts`), build
(`vite.config.ts` → `index.html` tokens + `manifest.json`) aur Worker
(`worker/src/index.ts`) teeno wahi se padhte hain. `tests/brand-config.test.mjs`
fail ho jata hai agar koi production URL ya brand string dobara hardcode ho jaye.

## Troubleshooting

| Symptom | Wajah |
|---------|-------|
| `/api/...` par 404 | Worker route missing/typo (Step 2) |
| Browser me CORS error | Worker `*_HOST`/`APP_DOMAIN` vars theek nahi, ya `ALLOWED_ORIGINS` |
| `redirect_uri not allowed` / `invalid_client` | Accounts row (Step 4) update nahi hui |
| Site purana naam dikha rahi hai | Pages env var set hai ya browser/PWA cache — hard refresh + PWA re-add |
| Preview (`*.pages.dev`) par demo mode dikh raha hai | Expected: demo sirf non-production hosts par chalta hai |
