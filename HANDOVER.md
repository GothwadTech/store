# 🤝 HANDOVER.md — New AI / New Chat? Start Here.

> **This is the single context file for Gothwad Store.** If you are a new AI
> session (or a human) picking up this repo, read this file first — it tells
> you what the product is, which decisions are locked, what is already built
> and verified, and exactly what remains. You do **not** need any previous
> chat history.
>
> **Reading order after this file:** [`PLAN.md`](PLAN.md) (full design) →
> [`TASK.md`](TASK.md) (live checklist) → [`sql/README.md`](sql/README.md)
> (before touching SQL) → [`docs/SETUP.md`](docs/SETUP.md) (deployment).
>
> **Last updated:** 2026-10-16 (Session 2) · Session 1 ka kaam PR **#1** se
> `main` me merge ho chuka hai. Session 2 (admin domain change + asli backend
> wiring, §4.8) branch `arena/31dfaecf-store` par hai — uska PR merge karo.

---

## 1. What This Product Is

**Gothwad Store** — the official app store of the Gothwad ecosystem
(think: Google's single-account ecosystem, but Gothwad's). One repo,
one frontend build, one API, four websites:

| Site | Production domain | Purpose |
|------|-------------------|---------|
| 🛍️ Web Store | `store.gothwadtech.com` | Play-Store-style storefront: browse, search, app pages, reviews, downloads |
| 🧑‍💻 Developer Console | `console.gothwadtech.com` | Indus/Play-Console-style publishing console for developers |
| 🛡️ Admin | `storeadmin.gothwadtech.com` | Manual review queue, app suspend/restore, user reports |
| 📱 Store App page | `storeapp.gothwadtech.com` | Landing page to download the Gothwad Store **Android** app |

The Android app itself is a **separate repo** (`GothwadTech/storeapp`,
Kotlin/Compose). It is only a client — it must consume **this repo's Worker API**.

**Related repos (context, do not modify from here):**
- `GothwadTech/accounts` — Gothwad Accounts: central SSO + OAuth 2.0 provider.
  Its `docs/OAUTH.md` is the source of truth for login integration.
- `GothwadTech/mail` — Gothwad Mail: same architecture conventions were copied
  from there (separate Supabase project, Worker-fronted DB access, secrets
  only in the Worker).
- `GothwadTech/storeapp` — Android store app (client only).

---

## 2. 🔒 Locked Decisions — Do Not Change Without the Owner

These were decided explicitly by the owner. A new session must not "improve"
them away:

1. **One deployment unit.** A single Cloudflare **Pages** project (one build)
   serves all four domains; a single Cloudflare **Worker named `store`**
   (in `worker/`) serves every `/api/*` route. The server is identified by
   hostname (`src/lib/config.ts → detectMode()`). Never split into multiple
   frontends/workers without owner approval.
   ⚠️ The Worker name `store` must always match the Cloudflare dashboard
   Worker name. Do not rename it. (The OAuth `client_id` is a different
   thing: **`gothwad-store`**.)
2. **Authentication = Gothwad Accounts only.** No password system may be built
   in this repo, ever. Flow: cookie SSO (Accounts cookie on
   `.gothwadtech.com`) first, OAuth 2.0 Authorization Code + PKCE (S256)
   fallback. Server-side Accounts calls go to `https://api.gothwadtech.com`
   (custom domain — same-zone rule learned from the Mail project), browser
   links to `https://accounts.gothwadtech.com`. Registration of the
   `gothwad-store` client in Accounts' `ecosystem_apps` is a pending human
   step (see §7).
3. **Supabase = database only.** Store gets its **own new Supabase project**
   (`gothwad-store`), separate from Accounts and Mail. **Supabase Storage is
   NOT used — no bucket exists and none may be created.** The database holds
   metadata only (500 MB free tier is plenty for that). The service-role key
   lives **only** as a Worker secret; the frontend never talks to Supabase
   directly (all traffic goes through the Worker).
4. **File storage — exactly three providers, fixed routing:**
   - **Images** (icons, screenshots, feature graphics, logos) → **ImgBB only**.
     Because ImgBB has no on-the-fly transforms, images are resized/compressed
     **in the browser before upload** (`compressImage()` in `src/lib/storage.ts`).
     Cloudinary was considered and explicitly rejected by the owner.
   - **APK ≤ 25 MB** → **GitHub** repository **`GothwadTech/storefiles`**
     (slug exactly `storefiles`; Releases, one tag per `package@versionCode`).
   - **APK > 25 MB** → **Backblaze B2** (S3-compatible, private bucket,
     Worker-generated presigned PUT for upload). The "B2 vs GitHub" decision
     must be made from the APK byte size — `apkProviderForSize()` in
     `src/lib/storage.ts` and the same constant in `worker/src/index.ts`.
     Keep the two in sync.
   - Cloudflare R2 is a *future* option only (it requires a card the owner
     does not have yet). Do not wire it in now.
5. **Manual review is mandatory for every APK.** Lifecycle:
   `draft → in_review → published` (or back to `draft` with a reviewer note;
   publishers may also `unlisted`; admins may `suspended`). A rejection
   **requires** a note that the developer can read. Text/image listing edits
   go live without review in Phase 1; APKs never do. This line must not be
   crossed.
6. **UI language = US English, everywhere, always.** All user-visible strings
   (Store, Console, Admin, landing page, API error messages, seed/demo
   content) are in US English. The owner communicates in Hinglish in chat,
   but the product UI must never contain Hindi/Hinglish text.
7. **Dark theme background is `#212121`** (neutral dark gray — Material-style).
   Surfaces: sidebar `#1d1d1d`, cards/panels `#2a2a2a`, inputs `#1e1e1e`,
   borders white at 6–12% opacity, emerald accent (Tailwind `emerald-*`).
   The old blue-gray `#0b1220` theme was removed on owner instruction; do not
   bring it back. `theme-color`, PWA manifest, and CSS tokens match `#212121`.
8. **Admins are defined by env, not DB.** `ADMIN_USERNAMES` in
   `worker/wrangler.toml` (comma-separated Gothwad Accounts usernames;
   currently `pawan`). The frontend's demo check mirrors this only for
   non-production hosts.
9. **Secrets never in git/code.** `SUPABASE_SERVICE_ROLE_KEY`,
   `IMGBB_API_KEY`, `GITHUB_FILES_TOKEN` (fine-grained, storefiles repo only),
   `B2_KEY_ID`, `B2_APP_KEY` — Worker secrets (dashboard or `wrangler secret
   put`) or `worker/.dev.vars` locally (git-ignored). Public values live in
   `worker/wrangler.toml` `[vars]` and root `.env.example` (Vite `VITE_*`).

---

## 3. Repository Map

```
store/
├── HANDOVER.md            ← you are here (start here)
├── PLAN.md                full design + phases (source of truth for design)
├── TASK.md                live checklist: done / next (UPDATE IT every session)
├── README.md              public face + local dev quickstart
├── docs/
│   ├── SETUP.md           step-by-step human deployment (6 steps)
│   └── DEVELOPER_GUIDE.md how external developers publish (policy included)
├── sql/                   🗄️ Supabase SQL — READ sql/README.md FIRST
│   ├── README.md          run order · idempotency rule · 600–1000 line file rule
│   └── 01_StoreSchema.sql 12 tables + RLS + category seed (idempotent)
├── index.html             SPA entry (theme-color #212121)
├── public/                manifest.json (PWA), icon.svg, _redirects (SPA fallback)
├── src/
│   ├── main.tsx           React root (AppProvider wrapper)
│   ├── App.tsx            hostname/mode selector + preview mode switcher
│   ├── index.css          Tailwind 4 + #212121 tokens
│   ├── types.ts           shared types (AppStatus, StoreApp, AppRelease, …)
│   ├── data/seed.ts       demo catalog (8 apps, reviews, submissions, reports)
│   ├── lib/
│   │   ├── config.ts      domains, mode detection, OAuth client config
│   │   ├── api.ts         Worker API client (store/dev/admin/uploads, upload flows)
│   │   ├── auth.ts        Gothwad sign-in (PKCE), /api/me, demo session
│   │   ├── storage.ts     provider routing (≤25MB GitHub / >25MB B2), image compression
│   │   ├── router.ts      tiny path router (no react-router dependency)
│   │   └── AppContext.tsx GLOBAL STATE: apps/releases/reviews/submissions/…
│   ├── shared/ui.tsx      Logo, AppIcon, Stars, StatusBadge, AppCard/Row, SignInPrompt
│   ├── store/StoreApp.tsx       🛍️ storefront shell
│   ├── console/ConsoleApp.tsx   🧑‍💻 developer console shell
│   ├── admin/AdminApp.tsx       🛡️ admin shell
│   └── landing/StoreAppLanding.tsx 📱 Store Android app download page
└── worker/
    ├── wrangler.toml      name="store", public [vars], routes documented inside
    ├── .dev.vars.example  local secret names (no values)
    ├── tsconfig.json
    └── src/
        ├── index.ts       the whole API (routes + Supabase CRUD, read its header)
        └── apk.ts         APK manifest auto-read (ZIP + binary AndroidManifest.xml)
```

**Stack (same as the Mail repo):** Vite + React 19 + TypeScript +
Tailwind CSS 4 (`@tailwindcss/vite`) + `lucide-react`. Worker is plain
TypeScript on Workers APIs (fetch-based Supabase REST, hand-rolled SigV4
for Backblaze B2). No database or HTTP libraries.

---

## 4. ✅ What Is Built and Verified

Verified on 2026-10-16: `npm run build` passes (frontend type-check + Vite),
`npx tsc -p worker/tsconfig.json --noEmit` passes, dev servers run
(frontend port **36161**, Worker port **8787**, `/api/health` OK through the
Vite proxy, all four modes return 200).

### 4.1 Storefront (`store.*`, `src/store/StoreApp.tsx`)
- Home: featured hero, "Top charts" rail, suggested/top-rated/new rows,
  category chips; separate **Apps** and **Games** views (`HomePage kind`)
- Search (`/search?q=`), category pages, top charts, developer pages
- **App detail** (`/app/:packageName`): stats strip (rating, downloads, size,
  version), Install button with simulated download progress, screenshot
  carousel, About, "What's new", Data-safety/permissions list (from live
  release), SHA-256 slot, wishlist, report, rating breakdown UI, write-a-review
  form, developer reply display, similar apps
- Library/Wishlist page (`/library`), mobile bottom navigation, desktop top nav
- PWA manifest + dark `#212121` Play-style layout

### 4.2 Developer Console (`console.*`, `src/console/ConsoleApp.tsx`)
Indus/Play-Console-inspired professional layout:
- **Shell:** fixed sidebar (grouped nav Overview/Insights/Account, developer
  card, publishing-guide box), top bar (breadcrumb, search, notifications,
  identity, sign out), footer. Metric `StatCard`, `Card`, and table styling
  are the console's design system — reuse them, keep buttons `rounded-lg`.
- **Onboarding:** 3-step indicator → developer registration (name, org,
  support email, website, policy agreement checkbox required)
- **Dashboard:** 4 metric cards (total apps, downloads, avg rating, pending
  reviews), rejected-submission alert, professional **apps table**
  (app/category/live version/status/downloads/rating)
- **Create app:** package-name format validation + taken/available live
  feedback, type + category, "Before you create" guidance panel.
  Package name is immutable by design.
- **App detail** with underlined tabs (`/apps/:id`, `/apps/:id/releases`,
  `/apps/:id/reviews`):
  - *Store listing:* details form, graphics (icon upload, screenshot grid with
    add/remove — browser-compressed, ImgBB-bound), contact & privacy,
    **sticky save bar** with discard
  - *Releases:* APK drop-zone that shows the GitHub/B2 rule from file size,
    version name/code + release notes, **release history table**, submit-for-review
  - *Reviews:* per-app reviews with developer reply
  - Unpublish/republish actions; reviewer rejection note banner
- **Statistics:** weekly download bar charts per published app + totals
- **Reviews:** cross-app review inbox with public replies
- **Developer profile settings** + read-only Gothwad Account identity card

### 4.3 Admin (`storeadmin.*`, `src/admin/AdminApp.tsx`)
- Gate: non-admin usernames get an explicit "Admin access required" screen
- **Review queue:** pending submissions with provider/size/submitted info,
  reviewer note field — **Approve and publish** / **Reject** (reject blocked
  without a note), recent-decisions history
- **All apps:** status badges, suspend/restore, featured label (read-only)
- **User reports:** open/resolve/dismiss workflow

### 4.4 Store App landing (`storeapp.*`, `src/landing/StoreAppLanding.tsx`)
- Hero with phone mock of the store, feature cards, developer CTA
- Download button wired to the live `com.gothwad.store` release
  (`/api/download/...`), QR code (api.qrserver.com) pointing at
  `https://storeapp.gothwadtech.com`

### 4.5 Cross-cutting behavior (important to know before editing)
- **State is hybrid since Session 2.** `src/lib/AppContext.tsx` boot par
  Worker se hydrate hota hai (`/api/store/apps` catalog → `/api/me` session →
  dev/admin bundles, `src/lib/api.ts` client se) aur saari actions asal user
  ke liye Worker API par jati hain. Backend **unconfigured** mile
  (`source: "unconfigured"` / 503) to wahi purana raasta: `src/data/seed.ts`
  se seed + `localStorage` (`gothwad-store-state-v1`) persistence + demo
  actions. Live mode me localStorage me kuch persist nahi hota — Worker hi
  source of truth hai. Demo user (`demo-user-1`) hamesha local mode me
  rehta hai.
- **Full demo loop works without any backend:** Demo sign-in (dev/preview
  only — the button is hidden on `*.gothwadtech.com` hosts; see
  `isProductionHost()` in `src/lib/auth.ts`, demo user `pawan`, which is
  also admin) → Console: create app → upload "APK" (only file name/size is
  read locally) → submit → Admin: approve → Store: app is live, downloadable.
  Objects created via `URL.createObjectURL` for icons are preview-only;
  in production they are ImgBB URLs returned by the Worker.
- **Mode switching:** production resolves by hostname. Anywhere else
  (localhost, `*.e2b.app` preview) `?mode=store|console|admin|storeapp`
  wins, then `localStorage gothwad-site-mode`, default `store`. A floating
  switcher renders only on non-production hosts (`src/App.tsx`).
- **Auth code is real, not a stub:** `src/lib/auth.ts` implements PKCE S256
  exactly per `GothwadTech/accounts` `docs/OAUTH.md` (authorize →
  `/auth/callback` → Worker `/api/auth/exchange` → userinfo), plus cookie
  SSO via Worker `/api/me`. What is missing is only the production
  registration + deployment (§7), not code.

### 4.6 Worker API (`worker/src/index.ts`)
Base: each production site proxies/serves the same Worker at `/api/*`.

| Endpoint | Status |
|----------|--------|
| `GET /api/health` | ✅ config snapshot (supabase/imgbb/github/b2/accounts) |
| `GET /api/me` | ✅ verifies Accounts cookie or Bearer via Accounts (`/api/auth/me`, `/oauth/userinfo`); attaches developer row + `isAdmin` when DB is configured |
| `POST /api/auth/exchange` | ✅ OAuth code → tokens (PKCE verifier) → user |
| `POST /api/auth/signout` | ✅ (stateless ack; cookies belong to Accounts) |
| `GET /api/store/categories`, `/api/store/home`, `/api/store/apps` (kind/category/q filters), `/api/store/apps/:packageName` (listing + screenshots + live release + reviews) | ✅ when Supabase configured; otherwise returns `source: "unconfigured"` payload so the frontend demo stays alive |
| `GET /api/download/:releaseId` | ✅ records a `downloads` row, 302-redirects to the stored GitHub/B2 URL |
| `POST /api/uploads/image` | ✅ proxies to ImgBB with the server-side key, returns `{provider, url, deleteUrl}` |
| `POST /api/uploads/apk-ticket` | ✅ size rule: ≤25 MB → GitHub worker-upload mode; >25 MB → B2 presigned PUT (SigV4, 1 h) + public URL |
| `POST /api/uploads/apk` | ✅ uploads ≤25 MB APK to GitHub `storefiles` Releases (`package@versionCode` tag), returns CDN URL |
| `POST /api/store/apps/:id/reviews|wishlist|report|library`, `GET /api/store/library|wishlist` | ✅ Session 2: login-ke-baad wale user actions (ek user = ek review, rating Worker par recompute) |
| `/api/dev/*` (register, apps CRUD + listing/screenshots, releases, submit, stats, reviews+reply) | ✅ Session 2: `sql/01` tables par, ownership + package-uniqueness + version-code-monotonic rules ke saath |
| `/api/admin/*` (queue, approve/reject — note reject par mandatory, suspend/restore, feature, reports resolve) | ✅ Session 2: approve par ek hi live release + app published; purana live version naye review ke dauran chalta rehta hai |
| `POST /api/uploads/apk-inspect` | ✅ Session 2: APK bina store kiye manifest auto-read (`worker/src/apk.ts`) + SHA-256 — console form auto-fill ke liye |

Safety behavior to preserve: unknown routes `404 {error, message}`;
Accounts/verify failures return JSON errors, never HTML; CORS only for the
four site origins, `localhost:*`, and `*.e2b.app` previews; all user-facing
messages in English.

### 4.7 Database (`sql/01_StoreSchema.sql`)
12 tables — `developers`, `categories` (seeded, 12 rows), `apps`,
`app_releases` (provider constrained to `github|b2`), `app_screenshots`,
`reviews` (one per user per app), `wishlists`, `downloads`, `library`,
`review_submissions`, `reports`, `featured` — plus indexes. RLS is enabled on
every table; public read is limited to published apps / screenshots /
reviews / categories / featured, and all writes go through the Worker with
the service-role key (which bypasses RLS). **No storage buckets.**

### 4.8 Session 2 changes (2026-10-16) — admin domain + backend wiring

- **Admin domain:** purana two-level admin domain →
  **`storeadmin.gothwadtech.com`** har jagah (hostname detection, SITE_URLS,
  `ADMIN_URL`, Worker routes, docs, OAuth redirect URI
  `https://storeadmin.gothwadtech.com/auth/callback`). Final chaaro domains:
  `store` · `console` · `storeadmin` · `storeapp` — sab one-level hain,
  isiliye free Universal SSL kaafi hai (Total TLS ki zaroorat khatm).
- **Worker CRUD implemented** (§4.6 wali table dekho) — 501 placeholder gaya.
  Worker DB rows ko `types.ts` shapes me map karke deta hai (Android app ke
  liye field naam wahi rakhe hain); raw `apk_url` browser ko kabhi nahi
  jata, hamesha `/api/download/:releaseId` milta hai.
- **Uploads asal me jude:** console images → `/api/uploads/image` (ImgBB,
  browser-compressed), APK → ticket rule (≤25 MB Worker→GitHub, >25 MB B2
  presigned direct PUT, progress ke saath), phir release CRUD se persist.
  B2 upload ke baad Worker URL ko verify nahi karta — release create par
  developer wahi `publicUrl` bhejta hai.
- **APK manifest:** `worker/src/apk.ts` best-effort ZIP+binary-XML parser
  (package/version/SDK/permissions) + SHA-256; fail ho to manual form fields
  fallback hain, package mismatch Worker par 400 hai.
- **`public/_redirects`** SPA fallback joda (Pages par refresh-404 khatm).
- **Verify kiya gaya:** `npm run build` + worker typecheck pass; mock
  Supabase/Accounts ke against poora Worker E2E aur synthetic APK
  (stored+deflated dono) se manifest parser test pass. Asli Supabase/GitHub/
  B2/ImgBB ke against live test owner ke §6.1 steps ke baad hi hoga.

---

## 5. How To Run It Locally

```bash
npm install
npm run worker:dev          # terminal 1 — Worker on http://127.0.0.1:8787
npx vite --port=36161 --host=0.0.0.0 --strictPort   # terminal 2 — current preview port
# (npm run dev is the same app on port 3000; vite.config.ts proxies /api → 8787)
```

- Open `http://localhost:36161/?mode=store` — use the floating switcher
  (bottom center, non-production only) to jump between the four sites.
- Click **Explore demo mode** on Console/Admin to sign in as `pawan`
  (developer + admin) without any backend. Reload keeps state via localStorage;
  clear `gothwad-store-state-v1` to reset to seed data.
- Health checks: `curl http://127.0.0.1:36161/api/health` (via proxy) or
  `curl http://127.0.0.1:8787/api/health`.
- Before every push: `npm run build` **and**
  `npx tsc -p worker/tsconfig.json --noEmit` must both pass.
- `npm run lint` runs the same two type-checks.

Note: production hosting is Cloudflare Pages + Worker routes (not the dev
servers above). Bind any manual server to `0.0.0.0` for previews, and never
add `localhost` URLs into browser-facing code (the Vite `/api` proxy exists
for exactly that reason).

---

## 6. 🚧 What Remains (in priority order)

### 6.1 Human / dashboard deployment — OWNER ONLY, blocks production
Full checklists live in [`docs/SETUP.md`](docs/SETUP.md). Summary:
1. Create the `gothwad-store` Supabase project (⚠️ free plan: 2 active
   projects per org — Accounts + Mail already exist; check org/plan first)
   and run `sql/01_StoreSchema.sql`.
2. Register the `gothwad-store` client in **Accounts'** `ecosystem_apps`
   (redirect URIs for all four `/auth/callback`s + localhost).
3. Create keys: ImgBB API key; GitHub fine-grained PAT for `storefiles`;
   Backblaze B2 private bucket + scoped key.
4. Cloudflare Pages: connect this repo (`npm run build` → `dist`), attach
   all four custom domains.
5. Worker `store`: fill `SUPABASE_URL` + B2 vars in `worker/wrangler.toml`,
   set the five secrets, add `/api/*` routes on all four domains, deploy.
6. Verify `/api/health` shows every `configured: true`, then run the first
   live loop (console upload → admin approve → store download → install).

### 6.2 Next engineering tasks (for the next AI session)

> ✅ Items **1–4 Session 2 me ho gaye** (upar §4.8 dekho). Bache hue 5–8 hi
> asal pending engineering hain; item 6 ka code hissa ready hai, phone par
> live test §6.1 (owner steps) ke baad hoga.

1. ~~**Worker CRUD:** implement `/api/dev/*` (register developer, create app,
   update listing, create release, submit-for-review, stats, reply) and
   `/api/admin/*` (queue, approve/reject with note, suspend/restore, reports,
   featuring) against the §4.7 schema, replacing the `501` placeholder.
   Rules to keep in the Worker (not the client): ownership checks on every
   dev route, package-name uniqueness, version-code monotonicity suggested,
   reject-requires-note, one review per user per app (DB unique already),
   downloads dedupe (basic IP+app+day), rating aggregate update on review
   write. Keep English JSON errors `{error, message}`.
2. ~~**Frontend ↔ API wiring:** move `AppContext` reads/writes (public store
   first, then console/admin) from local state to the Worker; keep seed data
   only as an unconfigured-backend fallback; map API responses to the
   existing `types.ts` shapes (the Android app depends on them too — do not
   rename fields casually).
3. ~~**Real uploads:** wire console image uploads to `POST /api/uploads/image`
   (ImgBB) and APK flow to `apk-ticket`/`apk` (GitHub ≤25 MB via Worker;
   B2 presigned direct upload >25 MB) with progress; persist returned URLs
   through the CRUD endpoints from step 1.
4. ~~**APK manifest parsing** in the Worker (`worker/src/apk.ts`):~~ (ban gaya hai —)
   best-effort extract package name, versionCode/name, min/target SDK and
   permissions from `AndroidManifest.xml` (APK = ZIP, binary XML); fall back
   to manual form fields; verify package matches the listing.
5. **Auth hardening pass:** confirm rotated Accounts cookies are forwarded
   correctly on all four subdomains against the live Accounts deployment
   (the Mail project hit this class of bug — signed-in loops — so test the
   real cookie SSO, not just demo mode); add the returned-session diagnostic
   (401 only for a real Accounts 401; other failures surface as distinct
   5xx codes) like Mail does.
6. **Live end-to-end test** on a real Android phone, then update `TASK.md`.
7. **Reviews/statistics polish:** rating breakdown bars from real review
   counts; stats from the `downloads` table (daily series, not demo math).
8. **Android integration (separate repo):** replace `DummyStoreData` in
   `GothwadTech/storeapp` with this API (`https://store.gothwadtech.com/api`),
   mapping responses onto its existing `AppItem` fields; Android login uses
   the same `gothwad-store` OAuth client (add its redirect URI in Accounts).

### 6.3 Known limitations / risks (do not rediscover these)
- **Free tiers bite in specific places:** Supabase 500 MB DB / 1 GB
  storage / 2 active projects per org / 7-day inactivity pause; ImgBB is
  unlimited-ish but has no transforms or SLA (browser-side compression is
  load-bearing); GitHub Releases is a distribution mirror, not a sole copy
  (SHA-256 is stored per release; keep a B2 backup of every APK); B2's free
  allowance is 10 GB. The Worker must keep absorbing provider failures with
  clear English errors rather than crashing pages.
- **Current demo data is illustrative, not production content:** 8 seeded
  apps/reviews exist only so the UI is alive before the DB is wired. Do not
  treat seed download/rating numbers as real anywhere.
- **Listing edits currently bypass review (Phase 1 decision).** If abuse
  appears, move listing edits behind review too — the status machine already
  supports it.
- **No AAB support yet** (APK only — correct for direct installs). Release
  tracks, team members, paid apps, VirusTotal scans, and R2 migration are
  Phase 2/3 in `PLAN.md`; do not start them before §6.2 items 1–6 are live.

---

## 7. Working Rules for the Next Session

1. **Update `TASK.md` at the end of every session** (move items, date it),
   and amend this file when architecture or status materially changes.
   Future sessions trust these files over memory.
2. **SQL changes:** read `sql/README.md` first. New SQL goes into the current
   numbered file until ~600–1000 lines, then the next `NN_NameOfSql.sql`.
   Every statement idempotent (`if not exists`, `drop policy if exists`,
   `on conflict do update`). Never create Supabase Storage buckets.
3. **Never** put secrets in code, `wrangler.toml`, or git; never expose the
   service-role key or provider keys to the browser (uploads go through the
   Worker or its signed URLs).
4. Domains and hosts come from config (`src/lib/config.ts`,
   `worker/wrangler.toml` `[vars]`) — do not hardcode production domains in
   components, and do not call `localhost` from browser code.
5. UI copy stays **US English**; theme stays **#212121**; console components
   reuse the `Card`/`StatCard`/table vocabulary rather than inventing new
   card styles per page.
6. Git: work only on the session branch you were given; run §5 checks before
   pushing; keep commits descriptive. (`main` moves only through PRs.)
7. When in doubt about auth, copy `GothwadTech/accounts` `docs/OAUTH.md` —
   do not invent a new auth flow.

---

*End of handover. Next action for whoever reads this: if the Session 2 PR is
merged, deployment is §6.1 (owner) and the next build task is §6.2 item 5.*
