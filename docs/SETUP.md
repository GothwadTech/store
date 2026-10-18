# 📘 SETUP.md — Kiwi Store deploy (step-by-step, human ke liye)

Saara deployment **Cloudflare** par hai. Order wahi rakho jo neeche hai —
aadhe steps dashboard ke hain jo sirf owner kar sakta hai.

### Local / preview demo behavior

`localhost` and non-production previews retain sample listings and the optional
`pawan` demo identity for UI/workflow testing. Demo edits persist only in that
browser; sample APKs are not real, and the preview APK action does not upload a
file. Production APK uploads use GitHub storefiles for signed APKs up to 50 MB, with live progress.

On the apex `gothwadtech.com` and every `*.gothwadtech.com` hostname, the app
synchronously starts with empty frontend state and hides demo sign-in, seed
listings, and the development mode switcher. Production uses Gothwad Accounts
and live Worker/API data only; backend failure does not fall back to samples.

---

## Step 1 — Supabase (Store ka APNA project)

1. [supabase.com](https://supabase.com) → **New project**, naam: `kiwi-store`
   ⚠️ Dhyaan: free plan me per-organization **2 active projects** ki limit hoti
   hai — Accounts + Mail pehle se hain to pehle wali org/plan check kar lena.
2. SQL Editor → is repo ki `sql/01_StoreSchema.sql` poori chala do
   (12 tables + RLS + categories seed; dobara chalane par error nahi ayega).
   **Storage bucket mat banana** — images ImgBB aur APKs GitHub Releases par jate hain.
3. Settings → API se note karo: **Project URL** + **service_role key** (secret!).

## Step 2 — Gothwad Accounts me Store ko register karo

Accounts ke Supabase me (`ecosystem_apps` table) ek row:

```sql
-- id / client_id = 'kiwi-store', scopes: profile email offline_access
-- redirect_uris = ARRAY[
--   'https://kiwistore.gothwadtech.com/auth/callback',
--   'https://kiwiconsole.gothwadtech.com/auth/callback',
--   'https://kiwiadmin.gothwadtech.com/auth/callback',
--   'http://localhost:3000/auth/callback' ]
```

(Accounts repo ka `docs/OAUTH.md` hi is kaam ka source of truth hai.)

## Step 3 — File providers ke accounts

| Provider | Kya banana hai | Kya milega |
|----------|---------------|-----------|
| **ImgBB** | imgbb.com par account → api.imgbb.com se key | `IMGBB_API_KEY` |
| **GitHub** | Public repo **`GothwadTech/storefiles`** → Settings → Developer settings → Fine-grained PAT (sirf is repo, Contents+Releases write) | `GITHUB_FILES_TOKEN` |

## Step 4 — Cloudflare Pages (chaaro sites, ek project)

1. Workers & Pages → Create → **Pages** → is repo (`GothwadTech/store`) jodo.
2. Build: command `npm run build`, output `dist`.
   Env zaroori nahi — defaults `shared/brand.ts` me hain (`Kiwi Store` +
   `kiwistore/kiwiconsole/kiwiadmin/kiwiapp.gothwadtech.com`). Domain ya
   naam badalna ho to Pages → Settings → Environment variables me sirf yeh dal do:
   `VITE_APP_NAME`, `VITE_APP_DOMAIN` (ya per-site `VITE_STORE_URL` /
   `VITE_CONSOLE_URL` / `VITE_ADMIN_URL` / `VITE_STOREAPP_URL`). Poora list
   `.env.example` me hai — code change ki zaroorat nahi.
3. Custom domains — **chaaro** is ek project par lagao:
   `kiwistore.gothwadtech.com` · `kiwiconsole.gothwadtech.com` ·
   `kiwiadmin.gothwadtech.com` · `kiwiapp.gothwadtech.com`
   (Frontend hostname dekh kar khud sahi site khol lega.)
   Chaaro domain **one-level** subdomain hain, isiliye Cloudflare ka free
   **Universal SSL** (`*.gothwadtech.com`) chaaro ko cover kar deta hai —
   koi paid/advanced certificate lagane ki zaroorat nahi hai.

## Step 5 — Cloudflare Worker `store` (API)

1. `worker/wrangler.toml` me `SUPABASE_URL` me Step 1 wala URL dalo,
   GitHub storefiles owner/repo values check karo. `name = "store"` mat badalna.
   Naam/domain wale vars (`APP_NAME`, `APP_DOMAIN`, `STORE_HOST`, `CONSOLE_HOST`,
   `ADMIN_HOST`, `STOREAPP_HOST`, `OAUTH_CLIENT_ID`) dashboard → Worker →
   Settings → Variables se bhi badal sakte ho — code me kuch hardcode nahi hai.
2. Secrets (dashboard → Worker → Settings → Variables → **Secret** type, ya CLI):
   ```bash
   npm run worker:secrets:list   # sirf naam dikhte hain
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config worker/wrangler.toml
   npx wrangler secret put IMGBB_API_KEY --config worker/wrangler.toml
   npx wrangler secret put GITHUB_FILES_TOKEN --config worker/wrangler.toml
   ```
3. Routes (Worker → Settings → Domains & Routes → Add route) — **chaaro**:
   `kiwistore.gothwadtech.com/api/*` · `kiwiconsole.gothwadtech.com/api/*` ·
   `kiwiadmin.gothwadtech.com/api/*` · `kiwiapp.gothwadtech.com/api/*`
4. Deploy: `npm run worker:deploy` (ya Git auto-deploy Workers Builds se).
5. Check: `https://kiwistore.gothwadtech.com/api/health` →
   `configured` me sab `true` aana chahiye.

## Step 6 — Pehla asli chakkar (live test)

1. `kiwiconsole.gothwadtech.com` → Gothwad Account se sign in → developer bano
2. Ek test app + signed APK (≤50MB — GitHub upload/progress test hoga)
3. `kiwiadmin.gothwadtech.com` (ADMIN_USERNAMES wala username) → Approve
4. `kiwistore.gothwadtech.com` par app dikhe → Download → phone par install ✓

> Admin kaun hai: `worker/wrangler.toml` ka `ADMIN_USERNAMES` (comma separated
> Accounts usernames). Pehla naam owner ka rakho.
