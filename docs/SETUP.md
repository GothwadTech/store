# 📘 SETUP.md — Gothwad Store deploy (step-by-step, human ke liye)

Saara deployment **Cloudflare** par hai. Order wahi rakho jo neeche hai —
aadhe steps dashboard ke hain jo sirf owner kar sakta hai.

---

## Step 1 — Supabase (Store ka APNA project)

1. [supabase.com](https://supabase.com) → **New project**, naam: `gothwad-store`
   ⚠️ Dhyaan: free plan me per-organization **2 active projects** ki limit hoti
   hai — Accounts + Mail pehle se hain to pehle wali org/plan check kar lena.
2. SQL Editor → is repo ki `sql/01_StoreSchema.sql` poori chala do
   (12 tables + RLS + categories seed; dobara chalane par error nahi ayega).
   **Storage bucket mat banana** — files ImgBB/GitHub/B2 par jati hain.
3. Settings → API se note karo: **Project URL** + **service_role key** (secret!).

## Step 2 — Gothwad Accounts me Store ko register karo

Accounts ke Supabase me (`ecosystem_apps` table) ek row:

```sql
-- id / client_id = 'gothwad-store', scopes: profile email offline_access
-- redirect_uris = ARRAY[
--   'https://store.gothwadtech.com/auth/callback',
--   'https://console.gothwadtech.com/auth/callback',
--   'https://storeadmin.gothwadtech.com/auth/callback',
--   'http://localhost:3000/auth/callback' ]
```

(Accounts repo ka `docs/OAUTH.md` hi is kaam ka source of truth hai.)

## Step 3 — File providers ke accounts

| Provider | Kya banana hai | Kya milega |
|----------|---------------|-----------|
| **ImgBB** | imgbb.com par account → api.imgbb.com se key | `IMGBB_API_KEY` |
| **GitHub** | Public repo **`GothwadTech/storefiles`** → Settings → Developer settings → Fine-grained PAT (sirf is repo, Contents+Releases write) | `GITHUB_FILES_TOKEN` |
| **Backblaze B2** | backblaze.com → B2 Cloud Storage → private bucket (e.g. `gothwad-store-apks`) → App Keys (bucket-scoped) | `B2_KEY_ID`, `B2_APP_KEY`, bucket ka S3 endpoint (`s3.<region>.backblazeb2.com`) |

## Step 4 — Cloudflare Pages (chaaro sites, ek project)

1. Workers & Pages → Create → **Pages** → is repo (`GothwadTech/store`) jodo.
2. Build: command `npm run build`, output `dist`. (koi env abhi zaroori nahi)
3. Custom domains — **chaaro** is ek project par lagao:
   `store.gothwadtech.com` · `console.gothwadtech.com` ·
   `storeadmin.gothwadtech.com` · `storeapp.gothwadtech.com`
   (Frontend hostname dekh kar khud sahi site khol lega.)
   Chaaro domain **one-level** subdomain hain, isiliye Cloudflare ka free
   **Universal SSL** (`*.gothwadtech.com`) chaaro ko cover kar deta hai —
   koi paid/advanced certificate lagane ki zaroorat nahi hai.

## Step 5 — Cloudflare Worker `store` (API)

1. `worker/wrangler.toml` me `SUPABASE_URL` me Step 1 wala URL dalo,
   `B2_S3_ENDPOINT`/`B2_BUCKET` bharo. `name = "store"` mat badalna.
2. Secrets (dashboard → Worker → Settings → Variables → **Secret** type, ya CLI):
   ```bash
   npm run worker:secrets:list   # sirf naam dikhte hain
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config worker/wrangler.toml
   npx wrangler secret put IMGBB_API_KEY --config worker/wrangler.toml
   npx wrangler secret put GITHUB_FILES_TOKEN --config worker/wrangler.toml
   npx wrangler secret put B2_KEY_ID --config worker/wrangler.toml
   npx wrangler secret put B2_APP_KEY --config worker/wrangler.toml
   ```
3. Routes (Worker → Settings → Domains & Routes → Add route) — **chaaro**:
   `store.gothwadtech.com/api/*` · `console.gothwadtech.com/api/*` ·
   `storeadmin.gothwadtech.com/api/*` · `storeapp.gothwadtech.com/api/*`
4. Deploy: `npm run worker:deploy` (ya Git auto-deploy Workers Builds se).
5. Check: `https://store.gothwadtech.com/api/health` →
   `configured` me sab `true` aana chahiye.

## Step 6 — Pehla asli chakkar (live test)

1. `console.gothwadtech.com` → Gothwad Account se sign in → developer bano
2. Ek test app + chhota APK (≤25MB — GitHub wala raasta pehle test hoga)
3. `storeadmin.gothwadtech.com` (ADMIN_USERNAMES wala username) → Approve
4. `store.gothwadtech.com` par app dikhe → Download → phone par install ✓

> Admin kaun hai: `worker/wrangler.toml` ka `ADMIN_USERNAMES` (comma separated
> Accounts usernames). Pehla naam owner ka rakho.
