# 🛍️ PLAN.md — Gothwad Store (Web App Store + Developer Console)

> **Status: BUILDING 🚧** — 2026-10-16 se code shuru. Chaaro shells (Store /
> Console / Admin / StoreApp landing) + Worker + SQL is repo me ban gaye hain,
> live status [`TASK.md`](TASK.md) me dekho. Yeh file design ka source of truth hai.
>
> **Final faisle (owner):** 4 domains ek Pages par · storage sirf
> ImgBB + GitHub `store-files` (APK ≤25MB) + Backblaze B2 (>25MB) ·
> **Supabase Storage bilkul nahi** (Supabase = sirf database) · manual review.
>
> **Last updated:** 2026-10-16
> **Repo:** `GothwadTech/store` (yeh repo) · Android app alag repo
> [`GothwadTech/storeapp`](https://github.com/GothwadTech/storeapp) me ban raha hai —
> dono **ek hi backend** use karenge.

---

## 1. 🎯 KYA BAN RAHA HAI — 2 CHEEZEIN, 1 REPO

| # | Product | Domain | Kiske liye | Kis jaisa |
|---|---------|--------|-----------|-----------|
| 1 | **Gothwad Store (Web)** | `store.gothwadtech.com` | Public users — apps browse/search/download | Google Play Store (web look) |
| 2 | **Gothwad Developer Console (Web)** | `console.gothwadtech.com` | Developers — app publish/manage | Play Console / Indus Appstore Developer Console |

**Dono ek hi deployment hai** (owner ka decision ✅):

```
        ┌─────────────────────────────────────────────────┐
        │  EK repo: GothwadTech/store                     │
        │  EK Cloudflare Pages project (frontend, 1 build)│
        │  EK Cloudflare Worker "store" (API)             │
        │  EK alag Supabase project (Store ka apna, SIRF DB)│
        └─────────────────────────────────────────────────┘
              ▲                              ▲
   store · console · storeadmin · storeapp (Pages custom domains)
   storeapp.* = Store Android app ka download page
              │                              │
              └──── Frontend hostname dekh kar shell switch karega ────┘
                    store.*  → Store UI (Play Store look)
                    console.* → Console UI (Play Console look)
```

- Cloudflare Pages ek project par **kitne bhi custom domains** lag sakte hain — dono subdomain same build serve karenge.
- React app boot par `location.hostname` check karega: `console.*` hai to Console mode, warna Store mode. Routes bhi alag (`/` store home, console par `/` = dashboard).
- API bhi ek: Worker `store` dono par route hoga — `store.gothwadtech.com/api/*` **aur** `console.gothwadtech.com/api/*`. (Same-zone Worker-to-Worker wala issue yahan nahi hai — browser/API same origin rahenge, bilkul Accounts pattern par: frontend + `/api/*` ek origin.)
- **Android app (`storeapp` repo)** teesra client hai — wo bhi isi Worker API ko khayega (§10). Yani backend ek, clients teen (Web Store, Web Console, Android App).

---

## 2. 🏗️ ARCHITECTURE (Accounts/Mail pattern par hi)

```
┌─ BROWSER ──────────────────────────────────────────────┐
│  store.gothwadtech.com  /  console.gothwadtech.com     │
│  Vite + React + TS + Tailwind (Mail repo jaisi stack)  │  Cloudflare Pages (free)
│  kabhi Supabase se direct baat NAHI karega             │
└──────────────────┬─────────────────────────────────────┘
                   │  fetch /api/*  (same-origin)
┌──────────────────▼─────────────────────────────────────┐
│  CLOUDFLARE WORKER — name = "store"                    │
│  /api/store/*    public storefront API (bina login bhi)│
│  /api/dev/*      developer console API (login + dev)   │
│  /api/admin/*    review/admin API (sirf admin)         │
│  /api/me         session (Accounts cookie / token)     │
│  /api/download/:releaseId  → count + file par redirect │
└──────┬───────────────────────┬─────────────────────────┘
       │ service_role          │ verify session/token
       ▼                       ▼
┌──────────────────┐   ┌─────────────────────────────────┐
│ SUPABASE         │   │ GOTHWAD ACCOUNTS (alag repo)    │
│ (STORE ka APNA   │   │ accounts.gothwadtech.com        │
│  project — Mail/ │   │ api.gothwadtech.com             │
│  Accounts se     │   │ "Sign in with Gothwad" OAuth    │
│  ALAG)           │   │ client_id = gothwad-store       │
│ • Postgres + RLS │   └─────────────────────────────────┘
│ • Storage bucket │
│   (fallback)     │
└──────────────────┘
       ▲
       │  APK/icon/screenshot asal files — multi-provider (§6)
       └── GitHub Releases · Backblaze B2 · ImgBB (images)  [Supabase Storage NAHI]
```

**Ecosystem ke siddhant (Accounts/Mail se inherited, todna mat):**

1. **Har app ka apna Supabase project.** Store ke liye NEW Supabase project banega. Accounts ka DB sirf identity ke liye hai — Store usko kabhi direct nahi padhega, Mail ke DB ko to bilkul nahi.
2. **`SUPABASE_SERVICE_ROLE_KEY` sirf Worker me** (secret). Frontend me kabhi nahi. Frontend sirf Worker se baat karega.
3. **Domain hardcode nahi** — `wrangler.toml` ke `[vars]` me (`APP_DOMAIN`, `STORE_URL`, `CONSOLE_URL`, `AUTH_HUB_URL`...).
4. **Worker ka naam = `store`** (dashboard ke Worker naam se exact match; rename mat karna — Mail wala `mail` lesson). OAuth `client_id` usse alag cheez hai: **`gothwad-store`** (naming confusion wali galti dobara nahi).
5. Server-to-server Accounts calls ke liye base = **`https://api.gothwadtech.com`** (Accounts ka Custom Domain); browser links ke liye `AUTH_SIGNIN_URL = https://accounts.gothwadtech.com`. (Same-zone rule — Mail PLAN se liya gaya hai.)

---

## 3. 🔐 AUTH — "SIGN IN WITH GOTHWAD" (Gothwad Accounts)

Dono sites (Store + Console) ka login **sirf Gothwad Accounts** se hoga. Koi alag password system Store me NAHI banega.

### 3.1 Pehle Accounts repo me ek-baar ka kaam (human + SQL)

```sql
-- Gothwad ACCOUNTS ke Supabase me chalaana hai (Store ke me NAHI)
-- ecosystem_apps me nayi row: id/client_id = 'gothwad-store'
-- redirect_uris = ARRAY[
--   'https://store.gothwadtech.com/auth/callback',
--   'https://console.gothwadtech.com/auth/callback',
--   'https://storeadmin.gothwadtech.com/auth/callback',
--   'http://localhost:3000/auth/callback'        -- dev
-- ]
-- scopes: profile email offline_access
```

Ek hi `client_id` (`gothwad-store`) Phase 1 ke liye kaafi hai — chaaro subdomain usi ke redirect URIs hain. Baad me chaahe to `gothwad-store-console` alag kar sakte hain (review/analytics alag karne ke liye), abhi complexity nahi badhaani.

### 3.2 Login do raaste se chalega (Mail jaisa hybrid)

| Raasta | Kaise | Kab |
|--------|-------|-----|
| **Cookie SSO (primary)** | Accounts `.gothwadtech.com` par cookie set karta hai (`Domain=.gothwadtech.com`) → `store.*`/`console.*` par user pehle se logged-in milega. Worker `/api/me` par Accounts ke `/api/auth/me` ko proxy/verify karega | User pehle se kisi Gothwad app me logged in hai |
| **OAuth 2.0 Code + PKCE (fallback)** | "Sign in with Gothwad" button → `https://accounts.gothwadtech.com/api/oauth/authorize?client_id=gothwad-store&...` → consent → `/auth/callback` par code → Worker `/oauth/token` se exchange → `/oauth/userinfo` se profile | Cookie nahi hai / third-party browser |
| **Bearer token** | `Authorization: Bearer <accounts access_token>` — Worker `/oauth/userinfo` se verify | Android `storeapp` (uske paas cookie nahi hogi) |

PKCE code OAuth doc (`GothwadTech/accounts` → `docs/OAUTH.md`) se copy-paste hoga — wahi is integration ka source of truth hai. **Khud se auth invent mat karna.**

### 3.3 Store ke andar roles

| Role | Kaise banta hai | Kya kar sakta hai |
|------|-----------------|-------------------|
| **Visitor** | bina login | browse, search, app page dekhna, download |
| **User** | Gothwad login | + review/rating, wishlist, library ("My apps"), report |
| **Developer** | login + ek-baar **Developer Registration** (naam/org, support email, website, policy URL accept) → `developers` table me row | + Console access, apps create/upload |
| **Admin** | `ADMIN_USERNAMES` env var me Accounts usernames (e.g. `pawan`) — DB flag nahi, env hi source | + manual review queue, approve/reject, feature/feature-banner, app suspend |

Developer ban-na **ek-baar ka onboarding** hai (Play Console jaisa — identity + contact + policy agreement). Payment wala hisaab abhi nahi ($25 wala chakkar nahi — free hai, Gothwad abhi bada nahi hua 🙂).

---

## 4. 🛒 PRODUCT 1 — WEB STORE (`store.gothwadtech.com`)

Google Play Store ke web version jaisa look & feel: safed/hara... nahi — **Gothwad brand** (Accounts/Mail wali dark theme + brand blue design system reuse hogi; Play jaisa *layout*, rang apna).

### 4.1 Pages / Routes

| Route | Kya hai | Play me jaisa |
|-------|---------|---------------|
| `/` | Home — hero banner carousel (featured apps), "Suggested for you", Top charts strips, category chips, Editors' choice | Play Home |
| `/apps` , `/games` | Apps / Games tabs — curated rows (New, Top free, Trending) | Play Apps/Games |
| `/search?q=` | Search — naam/developer/category se, filters (rating, size, category) | Play Search |
| `/category/:slug` | Category page (Communication, Tools, Games-Action...) | Play Categories |
| `/app/:packageName` | **App detail page** (sabse important — §4.2) | Play app page |
| `/developer/:id` | Developer ki saari apps | Play dev page |
| `/charts` | Top Free / Top Grossing (abhi free hi) / Top New — ranked list | Play Top charts |
| `/library` 🔒 | Meri library — download/install history, wishlist | Play Library |
| `/wishlist` 🔒 | Wishlist | Play Wishlist |
| `/auth/callback` | Gothwad OAuth callback (login flow ka hissa) | — |
| `/signin` | "Sign in with Gothwad" wala simple page (Accounts par bhejta hai) | — |

### 4.2 App Detail Page (Play jaisa, section-by-section)

1. **Header:** badi icon, naam, developer naam (link), verified badge (admin de sakta hai), category
2. **Stats strip:** ⭐ rating + total reviews · ⬇ downloads (e.g. `10K+`) · size (MB) · version · updated date
3. **Install / Download button** (sabse bada, hara/brand rang) → APK download (§6 ka redirect) — Android par direct APK, desktop par bhi APK file download (QR code "phone par kholo" bonus Phase 2)
4. **Screenshots carousel** — phone screenshots, scrollable
5. **About** — full description, "What's new" (changelog latest version ka)
6. **Data safety & Permissions** — APK se nikli permissions ki list (Play "Data safety" jaisa simplified)
7. **Ratings & Reviews** — rating breakdown bars (5★..1★), reviews list, "Write a review" 🔒 (sirf logged-in, ek user = ek review per app, edit/delete apna)
8. **Developer card** — dev ki aur apps, support email/website
9. **Similar apps** — same category, rating order
10. **Report** link 🔒 — galat/malware app report (admin queue me jayega)

### 4.3 Store ke Phase-1 features (MVP)

- ✅ Browse/Search/Category/Charts (sirf **published** apps dikhenge)
- ✅ Download with count (duplicate counting rokne ke liye basic dedupe — IP+app+din)
- ✅ Reviews & ratings (login required), rating average/count app par auto-update (DB trigger/view)
- ✅ Wishlist + Library (login required)
- ✅ Responsive — mobile web par bilkul Play app jaisa feel (bottom nav: Home · Apps · Games · Search · Library), desktop par left/top nav
- ✅ PWA (manifest + icons — Mail/Accounts ke assets pattern par) — "Add to Home screen"
- ✅ Dark theme default (Gothwad design system), light toggle
- ❌ Phase 1 me NAHI: paid apps/payment, in-app purchase, comments par like/reply (Phase 2), auto-update, web se phone par install push (Phase 3)

---

## 5. 🧑‍💻 PRODUCT 2 — DEVELOPER CONSOLE (`console.gothwadtech.com`)

Play Console / Indus Developer Console jaisa: left sidebar + dashboard. **Har developer sirf apni apps dekhega** (Worker har request par ownership check karega — DB RLS + Worker dono par).

### 5.1 Pages / Routes

| Route | Kya hai |
|-------|---------|
| `/` | **Dashboard** — meri apps ki list (icon, naam, package, status badge, downloads, rating), "Create app" button |
| `/onboarding` | Pehli baar — Developer registration form (§3.3) |
| `/apps/new` | **Create app** — app naam + package name (`com.company.app`, unique, ek baar set = change nahi) + default language |
| `/apps/:id` | App overview — status, latest version, stats summary, pending actions ("listing adhura hai" type warnings) |
| `/apps/:id/listing` | **Store listing** — title, short description (80 char), full description, icon (512), feature graphic, screenshots (min 2), category, tags, support email/website, privacy policy URL |
| `/apps/:id/releases` | **Releases** — version list; **naya release**: APK upload, versionCode/versionName (APK se auto-read koshish), changelog ("What's new"), release status |
| `/apps/:id/submit` | **Review submit** — checklist (listing complete? icon hai? kam se kam 1 release? sab tick) → "Submit for review" |
| `/apps/:id/stats` | **Statistics** — downloads (din/week/chart), installs estimate, rating trend, top countries (abhi IP-based rough — Phase 1 me sirf total + daily chart) |
| `/apps/:id/reviews` | **Reviews management** — apni app ke reviews padho, **reply** do (developer reply public dikhega) |
| `/apps/:id/settings` | App settings — app band (delist) karna, transfer/delete (danger zone, confirm ke saath) |
| `/settings` | Developer profile — org naam, logo, support email, website |

### 5.2 App ka lifecycle (status machine) — MANUAL REVIEW ✅ (owner decision)

```
  DRAFT ──submit──► IN_REVIEW ──admin approve──► PUBLISHED ──dev delist──► UNLISTED
   ▲                   │                             │  ▲                       │
   │                   └──admin reject───────────────┘  │ (listing update par    │
   │                       (reason sahit, dev ko dikhega)│  dubara review?        │
   └───────── dev edit karke phir submit ◄───────────────┘  → Phase 1: listing   │
                                                            edit = review nahi,  │
  PUBLISHED ──admin suspend (policy/malware)──► SUSPENDED ◄─┘ APK update = phir   │
                                                    review (naya version tab    │
                                                    live hoga jab approve ho)     │
```

**Review rules (Phase 1):**
- Har **naya APK version** review se jayega. Jab tak approve nahi, purana published version hi live rahega.
- Listing (text/images) edits bina review live — lekin admin kabhi bhi action le sakta hai. (Phase 2 me inhe bhi review me la sakte hain.)
- Admin panel: `/api/admin/*` + alag site **`storeadmin.gothwadtech.com`** (usi Pages project ka chautha domain, sirf `ADMIN_USERNAMES` wale ghus sakte hain).
- Review checklist (admin manually check karega): app khulti hai? naam/icon kisi doosri app ki chori to nahi? description sahi hai? khatarnak permissions (SMS, accessibility...) ka reason hai? malware shak → reject/suspend.
- Reject par **reason mandatory** — developer ko Console me dikhega, phir se submit kar sakta hai.

### 5.3 Console Phase-1 features (MVP)

- ✅ Developer onboarding, app create (package name unique check, live)
- ✅ Listing editor with image upload (icons/screenshots — §6 providers)
- ✅ APK upload (chunked/direct-to-storage signed upload — Worker se hokar bada file NAHI jayega), version management, changelog
- ✅ Submit/review/publish flow + admin queue
- ✅ Basic stats (downloads daily, total, rating)
- ✅ Reviews read + reply
- ❌ Phase 1 me NAHI: multiple release tracks (internal/alpha/beta — Phase 2), team members/roles (Phase 2), paid apps & payout (Phase 3), AAB support (Phase 2 — abhi **sirf APK**, AAB ko bina Play signing ke install nahi hota, yehi sahi bhi hai)

---

## 6. 💾 FILE HOSTING — APK / ICONS / SCREENSHOTS (sab options use karenge, size ke hisab se)

Owner ka sawaal tha: Supabase Storage ke alawa R2 ko card chahiye, "blaze..." (→ **Backblaze B2**) hai, Cloudinary hai, ImgBB hai, APK <25 MB ho to GitHub repo bhi hai — **kya best hai?**

**Jawaab: ek hi provider sab ke liye best nahi hai. Isliye Store me `StorageAdapter` pattern hoga — file ke type + size dekh kar Worker khud provider chunta hai.** Har file ka record DB me: `provider, key/url, sha256, size_bytes, mime`. Download hamesha Worker ke `/api/download/...` se — count hoga, phir asal file par 302 redirect (provider badalna ho to purane links nahi tootenge).

### 6.1 Saare options ki sachchai (free tiers, 2026)

| Provider | Free limit | Card? | APK ke liye? | Speed/CDN | Note |
|----------|-----------|-------|--------------|-----------|------|
| **Backblaze B2** ⭐ | 10 GB storage, roz 1 GB download free | ❌ nahi chahiye | ✅ **Primary (bade APK)** | Cloudflare ke saath "Bandwidth Alliance" — B2→Cloudflare egress **free**, Workers/CDN se serve | S3-compatible API. R2 ka best card-less replacement. Yehi tune yaad kiya tha — "Blaze" = Backblaze |
| **GitHub Releases** ⭐ | per-file 2 GB, repo ~reasonable use | ❌ | ✅ **Primary (chhote APK ≤25 MB)** | Fast global CDN (`objects.githubusercontent.com`) | Dedicated public repo e.g. `GothwadTech/store-files`, har release = `package@versionCode` tag. **Warning:** GitHub ToS — sirf file-dumping mirror mat bano; genuine project releases ke roop me rakho, aur B2/Supabase par hash + backup hamesha rakho taaki kal GitHub hata bhi de to file DB se dusre provider par shift ho jaye |
| **Supabase Storage** | 1 GB total, per-file 50 MB (free) | ❌ | ❌ **USE NAHI HOGA (owner decision)** | — | Supabase sirf DATABASE (500 MB metadata) ke liye hai. Files ke liye sirf ImgBB / GitHub / Backblaze B2 |
| **Cloudflare R2** | 10 GB + egress hamesha free | ✅ **card chahiye** (abhi nahi hai) | 🔜 **Future primary** | sabse best (Cloudflare native) | Card milte hi B2 se R2 par migrate — StorageAdapter ki wajah se sirf config badlegi. Code abhi se R2-ready (S3 API dono ka same hai) |
| **ImgBB** ⭐ | lagbhag unlimited images, per image 32 MB, free API | ❌ | ❌ sirf images | CDN, hotlink allowed | ✅ **Saari images ke liye PRIMARY (owner decision)** — icons, screenshots, feature graphic, developer logo, avatars. Cloudinary ki zaroorat NAHI hai (neeche §6.4 dekho) |
| **Cloudinary** | ~25 credits (~25 GB bandwidth/storage ke aas-paas) | ❌ | ❌ APK ke liye nahi | behtareen image CDN + on-the-fly resize | 🔜 **Sirf future option** — abhi use NAHI hoga. ImgBB me kabhi transformation/management ki kami lage to adapter me add ho jayega, ek env var se |

### 6.2 Routing rules (Worker khud decide karega)

```
Upload aayi
 ├─ KOI BHI IMAGE (icon / screenshot / feature graphic / dev logo)
 │    → ImgBB (ekmatra image host - fail ho to upload dobara, koi doosra provider nahi)
 │    (Upload se PEHLE browser side par canvas se resize/compress hoga —
 │     icon 512px, screenshot max 1080px wide, WebP/JPEG. Kaaran §6.4 me.)
 │
 └─ APK
      ├─ size ≤ 25 MB  → GitHub Releases (store-files repo) + SHA-256 DB me
      ├─ size > 25 MB  → Backblaze B2 (S3 API, private bucket, Worker signed URL)
      (🔜 Card milne par: B2 wala raasta R2 me badal jayega — ek env var)
```

- **Upload ka raasta:** Browser → Worker se signed/presigned URL lega → file **direct provider par** jayegi (Worker ke through 100 MB file nahi ghumegi — Workers ki limits hain). GitHub wale raaste me Worker khud Releases API se upload karega (server-side token, sirf ≤25 MB isiliye theek hai).
- Har APK ka **SHA-256 hash** DB me — app detail page par dikhega ("verify download"), duplicate/corrupted file pakdi jayegi.
- Download par: pehle Worker count karega, phir provider ke CDN URL par bhejega. B2 private bucket ke liye 1-ghante wala signed URL.

### 6.3 Environment / secrets iske liye

`GITHUB_FILES_TOKEN` (sirf `store-files` repo ka fine-grained PAT) · `B2_KEY_ID`/`B2_APP_KEY`/`B2_BUCKET` (ya R2 ke `R2_*` baad me) · `IMGBB_API_KEY` — sab **Worker secrets**, code/`wrangler.toml` me kabhi plain nahi (Mail ka `keep_vars`/secrets wala rule yahan bhi). Cloudinary ka koi secret abhi NAHI hai.

### 6.4 Cloudinary kyun NAHI (owner ka sawaal — faisla pakka)

Cloudinary ek hi kaam me mahir hai jo ImgBB nahi karta: **URL badal-badal kar on-the-fly image transform** (`w_200,h_200,c_fill/...` = wahi photo har size me, auto WebP/AVIF, CDN par cache). Uske alawa management dashboard, folders, signed/private images.

**Lekin is Store ko uski zaroorat nahi hai, kyunki:**
- Hamare images fixed type ke hain — icon, screenshot, feature graphic. Upload ke samay hi sahi size fix ho jata hai (browser canvas se resize/compress karke ImgBB par bhejenge — developer 5 MB ki screenshot de to bhi Store par halki wali hi jayegi).
- ImgBB free API = unlimited uploads, per image 32 MB, CDN + hotlink allowed — Store ki images public hi hain, private/signed ki need nahi.
- Ek provider kam = ek account kam, ek secret kam, code saral.

**Kab sochenge:** agar kabhi Store slow lage (badi images), ya har device ke liye alag size chahiye lage, to StorageAdapter me Cloudinary add kar denge — DB me `provider` field pehle se hai, migration nahi lagegi. Abhi ke liye **ImgBB hi kaafi hai. ✅**

---

## 7. 🗄️ SUPABASE — STORE KA APNA PROJECT

### 7.1 Setup (Phase 0 me human karega)

1. supabase.com → **New project** (naam: `gothwad-store`) — Accounts/Mail walo se **alag**.
2. Is repo ke `sql/` folder ki SQL files **number order** me chalegi (Accounts pattern: `01_...sql`, `02_...sql` — idempotent, dobara chalane par error nahi).
3. Keys: `SUPABASE_URL` (public, `wrangler.toml` me) + `SUPABASE_SERVICE_ROLE_KEY` (sirf Worker secret).
4. **Har table par RLS ON.** Public read sirf published apps ke liye; likhna zyadaatar Worker (service_role) karega.

### 7.1.1 ⚠️ SUPABASE FREE PLAN KA ASLI CHAKKAR (yeh confusion dobara na ho)

**Database (500 MB) aur File Storage (1 GB) do ALAG-ALAG dabbe hain — combined pool NAHI hai.** Dono ki limit alag gin-ti hai, ek ke bharne se dusra kam nahi hota:

| Dabba | Free limit | Isme kya jata hai | Store par asar |
|-------|-----------|-------------------|----------------|
| **Postgres Database** | **500 MB** (per project) | tables ki rows, text, numbers, indexes — jaise apps ki list, reviews, users, downloads ke records. **Metadata.** | Sirf metadata rakhne par 500 MB bohot hai — andaaza: lakhon reviews/rows aa jayengi. **Files DB me kabhi mat daalna** (base64 APK/image row me daala to yehi 500 MB khayega — Mail me attachments wala yehi khatra tha) |
| **File Storage (buckets)** | **1 GB** (per project, alag se) | asal files jo bucket me upload hon — PDF, image, APK, kuch bhi | Isi liye APK primary yahan NAHI rakhenge (§6) — 1 GB me ~20-30 APK hi aayenge. Sirf fallback |
| Bandwidth/Egress | ~5 GB + 5 GB cached / mahina | DB + Storage dono ke download ka data | Worker zyadaatar kaam CDN providers (ImgBB/B2/GitHub) se karwayega, isiliye ye limit saans leti rahegi |
| Per-file size (Storage) | 50 MB (free) | ek file isse badi Storage me nahi jayegi | APK >50 MB = hamesha B2/GitHub |
| Projects | 2 active free (per org) | Accounts + Mail + Store... | ⚠️ **Dhyaan:** teeno alag project hain — free org me sirf 2 active projects ki limit aati hai to Phase 0 me pehle check kar lena kaunsi org/plan par hain (Accounts/Mail wale pehle se chal rahe hain, Store teesra hoga) |
| Inactivity pause | 7 din bina activity = pause | — | Store public hoga, traffic se jagta rahega; SETUP me keep-alive tip ayegi |

Seedha hisaab: **DB = godown ka register (kaunsi file kahan hai), Storage/providers = asal godown.** Register 500 MB ka saalon chalega; asal maal ImgBB/B2/GitHub par rahega.

### 7.2 Tables (Phase 1 schema — `sql/01_StoreSchema.sql`)

| Table | Kya rakhegi | Zaroori columns |
|-------|-------------|-----------------|
| `developers` | developer profile (Accounts user se link) | `id, user_id (Accounts sub/uuid), username, display_name, org_name, support_email, website, logo_url, is_verified, created_at` |
| `apps` | ek app = ek row | `id, developer_id → developers, package_name UNIQUE, name, category, status (draft/in_review/published/unlisted/suspended), short_desc, full_desc, icon_url, feature_graphic_url, tags[], support_email, website, privacy_policy_url, downloads_count, rating_avg, rating_count, created_at, updated_at` |
| `app_releases` | har version | `id, app_id, version_code, version_name, apk_provider (github/b2), apk_key, apk_url, apk_size_bytes, apk_sha256, min_sdk, target_sdk, permissions[], changelog, review_status (pending/approved/rejected), review_note, is_live, created_at` |
| `app_screenshots` | screenshots (order sahit) | `id, app_id, url, provider, sort_order, type (phone/tablet)` |
| `categories` | fixed list (seed) | `slug, name, icon, type (app/game/both)` |
| `reviews` | user reviews + dev reply | `id, app_id, user_id, username, rating 1-5, body, developer_reply, developer_reply_at, created_at` (UNIQUE: ek user, ek app, ek review) |
| `wishlists` | user ↔ app | `user_id, app_id, created_at` (PK dono) |
| `downloads` | har download ka record (stats ke liye) | `id, app_id, release_id, user_id (nullable), ip_hash, user_agent, created_at` |
| `library` | "user ne kabhi download kiya" | `user_id, app_id, first_downloaded_at, last_version_code` |
| `review_submissions` | review queue ka itihaas | `id, app_id, release_id, submitted_by, status, admin_username, note, created_at, decided_at` |
| `reports` | user reports | `id, app_id, reporter_user_id, reason, details, status, created_at` |
| `featured` | home page curation (admin) | `id, app_id, section (hero/editors_choice/top_new), sort_order, starts_at, ends_at` |

**Supabase Storage bucket yahan NAHI banta** — files ImgBB/GitHub/B2 par hi jayengi (owner decision). SQL me bucket ka koi kaam nahi.

**Rating update:** `reviews` par trigger/view se `apps.rating_avg` + `rating_count` Worker ke review-write par update hoga (Phase 1 me Worker me calculate, trigger Phase 2 me sochenge — simple rakho).

---

## 8. ⚡ WORKER API (`store` — `worker/src/index.ts`)

Route: `store.gothwadtech.com/api/*` + `console.gothwadtech.com/api/*` (ek hi Worker, do routes).

### 8.1 Public Store API (login bina bhi)

```
GET    /api/health                      → { service: "store", configured: {...} }
GET    /api/store/home                  → hero + sections (featured, suggested, top, categories)
GET    /api/store/apps?tab=apps|games&category=&sort=&page=
GET    /api/store/search?q=&category=&minRating=
GET    /api/store/charts?type=top_free|top_new
GET    /api/store/categories
GET    /api/store/apps/:packageName     → full detail (listing + live release + screenshots)
GET    /api/store/apps/:packageName/reviews?page=
GET    /api/store/developers/:id        → dev profile + uski published apps
GET    /api/download/:releaseId         → count + provider URL par 302 (library me entry agar login hai)
```

### 8.2 User API (login — cookie/Bearer)

```
GET    /api/me                          → Accounts session verify karke {user, isDeveloper, isAdmin}
POST   /api/store/apps/:id/reviews      → {rating, body} (ek user ek review)
DELETE /api/store/apps/:id/reviews/me
POST   /api/store/apps/:id/wishlist     · DELETE bhi
GET    /api/store/library               · GET /api/store/wishlist
POST   /api/store/apps/:id/report
```

### 8.3 Developer API (login + developer, sirf APNI apps)

```
POST   /api/dev/register                       → developer onboarding
GET    /api/dev/apps                           · POST /api/dev/apps (package unique check)
GET    /api/dev/apps/:id                       · PATCH (listing) · POST /delist
POST   /api/dev/apps/:id/icon|screenshots      → upload ticket (provider URL) + confirm
POST   /api/dev/apps/:id/releases              → APK upload ticket (size dekh kar provider) 
POST   /api/dev/apps/:id/releases/:rid/submit  → review ke liye bhejo
GET    /api/dev/apps/:id/stats?days=30         → daily downloads + totals
GET    /api/dev/apps/:id/reviews               · POST /:reviewId/reply
```

### 8.4 Admin API (sirf `ADMIN_USERNAMES`)

```
GET    /api/admin/queue                  → pending submissions (sabse purana pehle)
POST   /api/admin/submissions/:id/approve · /reject {note} (note reject par mandatory)
POST   /api/admin/apps/:id/suspend · /unsuspend · /verify-developer
GET    /api/admin/reports                · POST /reports/:id/resolve
POST   /api/admin/featured               → home curation (hero/editors' choice order)
```

### 8.5 Worker ke andar ki baatein

- **Session verify:** pehle cookie (`gothwad_at`, Mail jaisa `/api/auth/me` proxy `api.gothwadtech.com` par) → na mile to `Authorization: Bearer` → Accounts `/oauth/userinfo`. Dono fail = 401 (sirf asal 401 par; Accounts down hai to **503 alag code** ke saath — Mail wala diagnostic lesson).
- **APK manifest reading (best-effort):** APK ek ZIP hai — Worker `AndroidManifest.xml` (binary XML) parse karke package/version/minSdk/permissions nikaalne ki koshish karega. Na ho paye to developer form me haath se bhar dega, admin review me verify karega. (Library Phase 1 me simple parser; perfect hona zaroori nahi.)
- **Rate limits:** download per IP, review submit per user, upload per developer — simple KV-free counters (Phase 1: Supabase table/Worker cache; zaroorat padi to KV baad me).
- Har response JSON, errors `{ error: "code", message: "..." }` (Mail/Accounts convention).

---

## 9. 📁 REPO STRUCTURE (Mail repo jaisa hi layout)

```
store/
├── PLAN.md                  ← yeh file (pehle yahi padho)
├── TASK.md                  ← live status board (Phase 0 se banana)
├── AGENTS.md                ← AI/working rules (Accounts se copy karke adapt)
├── README.md                ← repo ka mukh-patra + docs map
├── package.json             ← Vite React TS (Mail se pattern)
├── vite.config.ts
├── index.html
├── public/                  ← PWA manifest, icons (192/512 maskable), favicon
├── src/                     🌐 FRONTEND (ek hi SPA, hostname se mode)
│   ├── main.tsx  · App.tsx (hostname router: StoreApp | ConsoleApp)
│   ├── store/               Store UI — pages/, components/, hooks/
│   ├── console/             Console UI — pages/, components/
│   ├── shared/              auth (Gothwad login+PKCE), api client, theme, ui kit
│   └── index.css            Tailwind + Gothwad design tokens (dark default)
├── worker/                  ⚡ API
│   ├── wrangler.toml        name = "store", [vars], keep_vars = true
│   ├── .dev.vars.example
│   └── src/
│       ├── index.ts         routes (store / dev / admin / me / download)
│       ├── auth.ts          Accounts session + OAuth verify
│       ├── db.ts            Supabase REST (service_role)
│       ├── storage.ts       StorageAdapter (github/b2/imgbb/supabase, r2-ready)
│       ├── apk.ts           manifest parse (best-effort)
│       └── http.ts          CORS, JSON, errors
├── sql/                     🗄️ SUPABASE SQL (pehle sql/README.md padho)
│   ├── README.md            chalane ka order + idempotent niyam + file-size rule
│   └── 01_StoreSchema.sql   tables + RLS + categories seed (dobara run safe)
├── tests/                   config test, worker test, ui smoke (Mail pattern)
└── docs/
    ├── SETUP.md             step-by-step deploy (human ke liye)
    ├── DEVELOPER_GUIDE.md   bahari developers ke liye — publish kaise karein
    └── ACCOUNTS_SETUP.md    Accounts repo me client register karne ke steps
```

**Stack faisla:** Frontend = **Vite + React 19 + TypeScript + Tailwind CSS 4** (Mail repo se same — seekha hua hai, copy udhar se hoga). Accounts wala vanilla HTML/JS Store ke liye sahi nahi (badi app hai, components chahiye). Worker = TypeScript, `compatibility_date` taaza wala.

---

## 10. 📱 ANDROID APP (`storeapp` repo) SE CONNECTION

Android app alag repo me ban raha hai — wo is plan ka **teesra client** hai, alag backend NAHI.

- `storeapp` ke `AppItem` model ke fields (`packageName, name, developerName, category, rating, ratingCount, downloadCount, fileSizeMb, description, iconUrl`) bilkul `/api/store/apps` ke response se map honge — API response jaanboojh kar inhi naamo ke aas-paas rakha jayega taaki Android side `DummyStoreData` hata kar seedha API lage.
- Android ka base URL: `https://store.gothwadtech.com/api` (wahi Worker). Login wahan bhi Gothwad Accounts OAuth (PKCE, public client) — web wala hi flow, `client_id = gothwad-store` + Android ke redirect URI ko Accounts me add karna padega.
- **Is repo (store) me Android ka koi code nahi aayega.** Backend ready hote hi storeapp me sirf API integration ka kaam rahega (us repo ka apna plan wahan bane to bane).

---

## 11. 🚀 DEPLOYMENT (poora Cloudflare par — owner decision ✅)

| Cheez | Kahan | Naam/Note |
|-------|-------|-----------|
| Frontend | Cloudflare **Pages** (Git auto-deploy, is repo se) | ek project, **4 custom domains**: `store.gothwadtech.com` · `console.gothwadtech.com` · `storeadmin.gothwadtech.com` · `storeapp.gothwadtech.com` |
| API | Cloudflare **Worker** | name = **`store`**, routes: chaaro subdomains ke `/api/*` |
| Database | **Supabase** (naya project `gothwad-store`) | SQL is repo ke `sql/` folder se (sql/README.md dekho) |
| APK/images | GitHub Releases + Backblaze B2 + ImgBB (§6) | sab free, bina card |
| Auth | Gothwad Accounts (pehle se live pattern) | `gothwad-store` client register karna hai |
| DNS | Cloudflare (zone `gothwadtech.com` pehle se hai) | chaaro subdomain Pages/Worker par — dashboard steps `docs/SETUP.md` me likhe jayenge |

**Worker secrets (dashboard/`wrangler secret put`, kabhi git me nahi):**
`SUPABASE_SERVICE_ROLE_KEY` · `GITHUB_FILES_TOKEN` · `B2_KEY_ID` · `B2_APP_KEY` · `IMGBB_API_KEY` (+ baad me `R2_*`)
**Public vars (`wrangler.toml`):** `APP_DOMAIN=gothwadtech.com` · `STORE_URL` · `CONSOLE_URL` · `AUTH_HUB_URL=https://api.gothwadtech.com` · `AUTH_SIGNIN_URL=https://accounts.gothwadtech.com` · `SUPABASE_URL=<store project>` · `ADMIN_USERNAMES` · `ALLOWED_ORIGINS`

**Free-tier ki seemayein (pehle se jaan lo):** Supabase free 500 MB DB + 1 GB storage (isiliye APK wahan primary NAHI) · B2 10 GB ke baad download/storage ke paise (bohot chhote) · GitHub Releases ka fair-use dhyaan · ImgBB down ho to image upload rukega (doosra image provider janboojh kar nahi rakha) · Supabase 7 din inactive = pause (Store par traffic rahega to masla nahi; `docs/SETUP.md` me keep-alive tip).

---

## 12. 🗺️ PHASES / ROADMAP (execution order)

### Phase 0 — Setup (aadha din)
- [ ] Supabase project `gothwad-store` banao, URL + keys lo
- [ ] Accounts ke `ecosystem_apps` me `gothwad-store` register (SQL §3.1) — **human step**
- [ ] GitHub repo `GothwadTech/store-files` (public) + fine-grained PAT
- [ ] Backblaze B2 account + private bucket + app key · ImgBB API key
- [ ] Cloudflare: Worker `store` + Pages project khali khada karo, chaaro subdomain jodo
- [ ] Is repo me `TASK.md` + `AGENTS.md` banao (Accounts walo se adapt)

### Phase 1 — MVP: Store + Console ek saath (asli kaam)
1. [ ] `sql/01_StoreSchema.sql` — saari tables + RLS + categories seed → Supabase me chalao
2. [ ] Worker skeleton — `/api/health`, auth (`/api/me`), db/http helpers, config test (Mail pattern)
3. [ ] StorageAdapter — images ke liye ImgBB (+ Supabase fallback); APK ke liye GitHub + B2
4. [ ] Developer API — register, app create, listing, APK upload ticket, releases
5. [ ] Admin review API + Console ke andar admin queue
6. [ ] Console UI — onboarding, dashboard, create app, listing editor, releases, submit, stats, reviews
7. [ ] Store API — home/search/detail/charts/download
8. [ ] Store UI — Play-look home, app detail, search, category, charts, library/wishlist, reviews likhna
9. [ ] "Sign in with Gothwad" dono shells me (cookie SSO + OAuth PKCE fallback)
10. [ ] PWA, dark theme, responsive (mobile bottom-nav)
11. [ ] Tests — worker test + config test + UI smoke; `docs/SETUP.md`, `docs/DEVELOPER_GUIDE.md`
12. [ ] **Live test asli phone par** — ek test app publish karke poora chakkar: console upload → admin approve → store par dikha → download → install

### Phase 2 — (baad me, abhi detail nahi)
Release tracks (internal/beta) · AAB support · team members · listing edits bhi review me · advanced stats (country/device) · review par like/reply · screenshot video · VirusTotal auto-scan · R2 migration (card milne par)

### Phase 3 — (door ki baat)
Paid apps + payouts · web se phone par install push (Accounts session ke zariye) · auto-update channel Android app ke liye · developer API keys/CI se publish (fastlane jaisa `gothwad publish`)

---

## 13. ⚠️ KHULE FAISLE / RISKS (yaad rakhne ke liye)

1. **Ek `client_id` vs do** — abhi ek (`gothwad-store`) rakha hai; console alag karna ho to Phase 2 me sochenge. Final faisla Phase 0 me confirm karna.
2. **Admin kaun hai** — `ADMIN_USERNAMES` env me pehla naam owner ka Accounts username. Baad me DB role table la sakte hain.
3. **Listing edits bina review live honge** (Phase 1) — galat istemal hua to Phase 2 me inhe bhi review me daal denge. APK hamesha reviewed hi rahega — ye line nahi tootegi.
4. **GitHub Releases ka bharosa** — wo distribution mirror hai, ekmatra copy NAHI. Har APK ka hash DB me + ek backup provider par (B2) rakhna policy rahegi.
5. **Content policy** — kya allowed/kya nahi (pirated apps, mod APKs of paid apps, adult, malware) — publish hone se pehle chhoti policy page `docs/DEVELOPER_GUIDE.md` me likhni hai. **Mod/pirated APK allowed nahi** honge — warna Store ki credibility aur legal dono jayenge.
6. **Storeapp repo ka API freeze** — Store API ka response shape Phase 1 ke beech me badla to Android app ka integration bhi badlega; isiliye API shape pehle `/api/store/apps` se tay karke storeapp ko bata dena.

---

## 14. ✅ DEFINITION OF DONE (Phase 1 kab "ho gaya" khelege)

- [ ] Koi naya banda Gothwad account se `console.gothwadtech.com` par developer ban kar app + APK upload karke submit kar de
- [ ] Admin approve kare → app `store.gothwadtech.com` par dikhe, search me mile
- [ ] Visitor bina login ke app download karke Android par install kar le; logged-in user review + wishlist kar le
- [ ] Reject karne par developer ko reason dikhe aur wo sudhaar kar phir submit kar le
- [ ] Android `storeapp` wahi API se asli data dikhaane lage (DummyStoreData retire)
- [ ] `TASK.md` updated, `docs/SETUP.md` dekh kar dusra banda deploy kar le

---

> **Agla step:** Owner is plan ko padh kar bole kahan badlaav chahiye. Uske baad
> Phase 0 se kaam shuru — aur har session ke ant me `TASK.md` update hoga
> (Accounts/Mail repo ki aadat yahan bhi chalegi).
