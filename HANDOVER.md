# 🤝 HANDOVER.md — New AI / New Chat? Start Here.

> **This is the single context file for Kiwi Store.** If you are a new AI
> session (or a human) picking up this repo, read this file first — it tells
> you what the product is, which decisions are locked, what is already built
> and verified, and exactly what remains. You do **not** need any previous
> chat history.
>
> **Reading order after this file:** [`PLAN.md`](PLAN.md) (full design) →
> [`TASK.md`](TASK.md) (live checklist) → [`sql/README.md`](sql/README.md)
> (before touching SQL) → [`docs/SETUP.md`](docs/SETUP.md) (deployment).
>
> **Last updated:** 2026-10-16 (Session 4 — console publishing reliability:
> ImgBB preflight/retries, GitHub-only APK uploads with live progress, 50 MB cap,
> 23502 listing-save fix, and guided setup flow). Sessions 1–3 form the repository
> baseline; the current task branch is tracked by Arena.

---

## 1. What This Product Is

**Kiwi Store** — the official app store of the Gothwad ecosystem
(think: Google's single-account ecosystem, but Gothwad's). One repo,
one frontend build, one API, four websites:

| Site | Production domain | Purpose |
|------|-------------------|---------|
| 🛍️ Web Store | `kiwistore.gothwadtech.com` | Play-Store-style storefront: browse, search, app pages, reviews, downloads |
| 🧑‍💻 Developer Console | `kiwiconsole.gothwadtech.com` | Indus/Play-Console-style publishing console for developers |
| 🛡️ Admin | `kiwiadmin.gothwadtech.com` | Manual review queue, app suspend/restore, user reports |
| 📱 Store App page | `kiwiapp.gothwadtech.com` | Landing page to download the Kiwi Store **Android** app |

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
   thing: **`kiwi-store`**.)
2. **Authentication = Gothwad Accounts only.** No password system may be built
   in this repo, ever. Flow: cookie SSO (Accounts cookie on
   `.gothwadtech.com`) first, OAuth 2.0 Authorization Code + PKCE (S256)
   fallback. Server-side Accounts calls go to `https://api.gothwadtech.com`
   (custom domain — same-zone rule learned from the Mail project), browser
   links to `https://accounts.gothwadtech.com`. Registration of the
   `kiwi-store` client in Accounts' `ecosystem_apps` is a pending human
   step (see §7).
3. **Supabase = database only.** Store gets its **own new Supabase project**
   (`kiwi-store`), separate from Accounts and Mail. **Supabase Storage is
   NOT used — no bucket exists and none may be created.** The database holds
   metadata only (500 MB free tier is plenty for that). The service-role key
   lives **only** as a Worker secret; the frontend never talks to Supabase
   directly (all traffic goes through the Worker).
4. **File storage — two-provider, reliable routing:**
   - **Images** (icons, screenshots, feature graphics, logos) → **ImgBB only**.
     The console validates, normalizes, and browser-compresses them before upload
     (`prepareImage()` in `src/lib/storage.ts`), with retries for transient ImgBB
     failures. Cloudinary was considered and explicitly rejected by the owner.
   - **APK ≤ 50 MB** → **GitHub** repository **`GothwadTech/storefiles`**
     (slug exactly `storefiles`; Releases, one tag per `package@versionCode`).
     The browser shows actual byte progress through the Worker. APKs over 50 MB
     are rejected before upload so the one supported route stays reliable.
   - **Backblaze B2 is removed.** Do not reintroduce direct B2/presigned upload
     code, configuration, or secrets without an explicit new owner decision.
   - Cloudflare R2 is a *future* option only (it requires a card the owner
     does not have yet). Do not wire it in now.
5. **Manual review is mandatory for every APK.** Lifecycle:
   `draft → in_review → published` (or back to `draft` with a reviewer note;
   publishers may also `unlisted`; admins may `suspended`). A rejection
   **requires** a note that the developer can read. Text/image listing edits
   go live without review in Phase 1; APKs never do. This line must not be
   crossed.
6. **UI language = US English, everywhere, always.** All user-visible strings
   (Store, Console, Admin, landing page, and API error messages) are in US
   English. The owner communicates in Hinglish in chat,
   but the product UI must never contain Hindi/Hinglish text.
7. **Dark theme background is `#212121`** (neutral dark gray — Material-style).
   Surfaces: sidebar `#1d1d1d`, cards/panels `#2a2a2a`, inputs `#1e1e1e`,
   borders white at 6–12% opacity, emerald accent (Tailwind `emerald-*`).
   The old blue-gray `#0b1220` theme was removed on owner instruction; do not
   bring it back. `theme-color`, PWA manifest, and CSS tokens match `#212121`.
8. **Production admins are defined by env, not DB.** `ADMIN_USERNAMES` in
   `worker/wrangler.toml` (comma-separated Gothwad Accounts usernames;
   currently `pawan`). The Worker is the sole authority on production. The
   separate local/preview demo identity (`pawan`) may exercise the demo admin
   UI only on non-production hostnames; a synchronous hostname gate prevents
   that identity and its controls from rendering on `gothwadtech.com` domains.
9. **Secrets never in git/code.** `SUPABASE_SERVICE_ROLE_KEY`,
   `IMGBB_API_KEY`, `GITHUB_FILES_TOKEN` (fine-grained, storefiles repo only),
   — Worker secrets (dashboard or `wrangler secret
   put`) or `worker/.dev.vars` locally (git-ignored). Public values live in
   `worker/wrangler.toml` `[vars]` and root `.env.example` (Vite `VITE_*`);
   app name + domain **defaults** live only in `shared/brand.ts` and are always
   overridable by those variables.

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
│   ├── DEVELOPER_GUIDE.md how external developers publish (policy included)
│   └── KIWI_MIGRATION.md  🥝 Gothwad → Kiwi: Pages/Worker/Accounts dashboard steps
├── sql/                   🗄️ Supabase SQL — READ sql/README.md FIRST
│   ├── README.md          run order · idempotency rule · 600–1000 line file rule
│   └── 01_StoreSchema.sql 12 tables + RLS + category seed (idempotent)
├── index.html             SPA entry (theme-color #212121)
├── public/                brand icons (/assets), _redirects (SPA fallback)
├── shared/                🥝 brand.ts — app name + site domains ka single source of truth
├── src/
│   ├── main.tsx           React root (AppProvider wrapper)
│   ├── App.tsx            hostname/mode selector + preview mode switcher
│   ├── index.css          Tailwind 4 + #212121 tokens
│   ├── types.ts           shared types (AppStatus, StoreApp, AppRelease, …)
│   ├── data/seed.ts       sample listings/actions for local/preview only
│   ├── data/categories.ts category display labels used by the UI
│   ├── lib/
│   │   ├── config.ts      shared/brand.ts + env (VITE_*) se domains, mode detection, prod/demo gate
│   │   ├── api.ts         Worker API client (store/dev/admin/uploads, upload flows)
│   │   ├── auth.ts        Gothwad sign-in (PKCE), /api/me, preview demo identity
│   │   ├── storage.ts     GitHub APK limit (≤50MB), image preparation/compression
│   │   ├── router.ts      tiny path router (no react-router dependency)
│   │   └── AppContext.tsx GLOBAL STATE: apps/releases/reviews/submissions/…
│   ├── shared/ui.tsx      🎨 design system: Button/Card/PageHeader/StatCard/Tabs/Sheet/
│   │                      EmptyState/Skeleton/Pill/Avatar/AccountMenu/SiteFooter/useToast
│   │                      + Logo, AppIcon, Stars, StatusBadge, AppCard/Row, SignInPrompt
│   ├── store/StoreApp.tsx       🛍️ storefront shell
│   ├── console/ConsoleApp.tsx   🧑‍💻 developer console shell
│   ├── admin/AdminApp.tsx       🛡️ admin shell
│   └── landing/StoreAppLanding.tsx 📱 Store Android app download page
├── tests/                 node:test suites (`npm test`) + brand/domain config guards
│   └── ui/render-smoke.mjs  built bundle ko jsdom me chala kar 8 surfaces render karta hai
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
TypeScript on Workers APIs (fetch-based Supabase REST). No database or HTTP libraries.

---

## 4. ✅ What Is Built and Verified

Verified on 2026-10-16: `npm run build` passes (frontend type-check + Vite),
`npx tsc -p worker/tsconfig.json --noEmit` passes, dev servers run
(frontend port **36161**, Worker port **8787**, `/api/health` OK through the
Vite proxy, all four modes return 200).

### 4.1 Storefront (`kiwistore.*`, `src/store/StoreApp.tsx`)
- Home: featured hero, "Top charts" rail, suggested/top-rated/new rows,
  category chips; separate **Apps** and **Games** views (`HomePage kind`)
- Search (`/search?q=`), category pages, top charts, developer pages
- **App detail** (`/app/:packageName`): stats strip (rating, downloads, size,
  version), live Install action, preview-only simulated sample download,
  screenshot carousel, About, "What's new", Data-safety/permissions list,
  SHA-256 slot, wishlist, report, rating breakdown UI, write-a-review form,
  developer reply display, similar apps
- Library/Wishlist page (`/library`), mobile bottom navigation, desktop top nav
- PWA manifest + dark `#212121` Play-style layout

### 4.2 Developer Console (`kiwiconsole.*`, `src/console/ConsoleApp.tsx`)
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
  feedback, type + category, inline failure state, and guided next-step panel.
  Package name is immutable by design.
- **App detail** with underlined tabs (`/apps/:id`, `/apps/:id/releases`,
  `/apps/:id/reviews`):
  - *Store listing:* details form, graphics (icon upload, screenshot grid with
    add/remove — browser-compressed; local demo stores data URLs, live mode uses
    ImgBB), contact & privacy, **sticky save bar** with discard
  - *Releases:* GitHub-only APK drop-zone (≤50MB), background preflight, live byte
    progress, version name/code + release notes, **release history table**, submit-for-review;
    preview accepts a local simulated release without uploading APK bytes
  - *Reviews:* per-app reviews with developer reply
  - Unpublish/republish actions; reviewer rejection note banner
- **Statistics:** weekly download charts + totals from the Worker for real users;
  explicitly labeled illustrative sample values in local demo mode
- **Reviews:** cross-app review inbox with public replies
- **Developer profile settings** + read-only Gothwad Account identity card

### 4.3 Admin (`kiwiadmin.*`, `src/admin/AdminApp.tsx`)
- Gate: non-admin usernames get an explicit "Admin access required" screen
- **Review queue:** pending submissions with provider/size/submitted info,
  reviewer note field — **Approve and publish** / **Reject** (reject blocked
  without a note), recent-decisions history
- **All apps:** status badges, suspend/restore, featured label (read-only)
- **User reports:** open/resolve/dismiss workflow

### 4.4 Store App landing (`kiwiapp.*`, `src/landing/StoreAppLanding.tsx`)
- Hero with phone mock of the store, feature cards, developer CTA
- Download button wired to the live `com.gothwad.store` release
  (`/api/download/...`), QR code (api.qrserver.com) pointing at
  `https://kiwiapp.gothwadtech.com`

### 4.5 Cross-cutting behavior (important to know before editing)
- **Local/preview demo is intentionally retained.** The original seed catalog,
  reviews/submissions/reports, demo `pawan` identity, local persistence, and
  local-only actions are available on localhost and non-production previews.
  Sample APKs are not real and preview releases are never uploaded.
- **Production is gated synchronously before first render.** `isDemoModeAllowed()`
  in `src/lib/config.ts` rejects the apex and every host inside the configured
  brand zone (`APP_DOMAIN`, default `gothwadtech.com`).
  In those origins the initial state is empty, sample categories/demo user are
  absent (live categories may load from API), demo login and mode-switcher
  controls are hidden, and backend failures never
  fall back to seed/local data. Old demo storage keys are cleared after render
  without ever displaying their values.
- **Real users use the Worker API only.** The frontend hydrates from catalog →
  session → developer/admin bundles. API writes do not silently become local
  writes on network or configuration failure. The Worker remains the sole
  production authority for admin access.
- **Mode switching:** production resolves by hostname. Anywhere else
  (localhost, `*.e2b.app` preview) `?mode=store|console|admin|storeapp`
  wins, then `localStorage kiwi-site-mode`, default `store`. A floating
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
| `GET /api/health` | ✅ config snapshot (supabase/imgbb/github/accounts) |
| `GET /api/me` | ✅ verifies Accounts cookie or Bearer via Accounts (`/api/auth/me`, `/oauth/userinfo`); attaches developer row + `isAdmin` when DB is configured |
| `POST /api/auth/exchange` | ✅ OAuth code → tokens (PKCE verifier) → user |
| `POST /api/auth/signout` | ✅ (stateless ack; cookies belong to Accounts) |
| `GET /api/store/categories`, `/api/store/home`, `/api/store/apps` (kind/category/q filters), `/api/store/apps/:packageName` (listing + screenshots + live release + reviews) | ✅ when Supabase configured; otherwise returns an empty `source: "unconfigured"` payload (no fixture data) |
| `GET /api/download/:releaseId` | ✅ records a `downloads` row, 302-redirects to the stored GitHub URL |
| `POST /api/uploads/image` | ✅ proxies to ImgBB with the server-side key, returns `{provider, url, deleteUrl}` |
| `POST /api/uploads/apk` | ✅ uploads APKs up to 50 MB to GitHub `storefiles` Releases (`package@versionCode` tag), returns CDN URL + manifest/hash |
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
`app_releases` (new releases constrained by the Worker to `github`), `app_screenshots`,
`reviews` (one per user per app), `wishlists`, `downloads`, `library`,
`review_submissions`, `reports`, `featured` — plus indexes. RLS is enabled on
every table; public read is limited to published apps / screenshots /
reviews / categories / featured, and all writes go through the Worker with
the service-role key (which bypasses RLS). **No storage buckets.**

### 4.8 Session 2 changes (2026-10-16) — admin domain + backend wiring

*(Us waqt ke naam `store` · `console` · `storeadmin` · `storeapp` the; Session 3
(§4.9) me sab `kiwi*` ho gaye — neeche wale domain references aaj ke naam me hain.)*

- **Admin domain:** purana two-level admin domain →
  **`kiwiadmin.gothwadtech.com`** har jagah (hostname detection, SITE_URLS,
  `ADMIN_URL`, Worker routes, docs, OAuth redirect URI
  `https://kiwiadmin.gothwadtech.com/auth/callback`). Final chaaro domains:
  `kiwistore` · `kiwiconsole` · `kiwiadmin` · `kiwiapp` — sab one-level hain,
  isiliye free Universal SSL kaafi hai (Total TLS ki zaroorat khatm).
- **Worker CRUD implemented** (§4.6 wali table dekho) — 501 placeholder gaya.
  Worker DB rows ko `types.ts` shapes me map karke deta hai (Android app ke
  liye field naam wahi rakhe hain); raw `apk_url` browser ko kabhi nahi
  jata, hamesha `/api/download/:releaseId` milta hai.
- **Uploads asal me jude:** console images → `/api/uploads/image` (ImgBB,
  browser-compressed with validation/retries), APK → GitHub Worker upload (≤50 MB)
  with byte progress, then release CRUD persists the returned URL.
- **APK manifest:** `worker/src/apk.ts` best-effort ZIP+binary-XML parser
  (package/version/SDK/permissions) + SHA-256; fail ho to manual form fields
  fallback hain, package mismatch Worker par 400 hai.
- **`public/_redirects`** SPA fallback joda (Pages par refresh-404 khatm).
- **Verify kiya gaya:** `npm run build` + worker typecheck pass; mock
  Supabase/Accounts ke against poora Worker E2E aur synthetic APK
  (stored+deflated dono) se manifest parser test pass. Asli Supabase/GitHub/
  ImgBB ke against live test owner ke §6.1 steps ke baad hi hoga.

---

### 4.9 Session 3 changes (2026-10-18) — Kiwi Store rebrand + config-driven domains

- **Product renamed:** `Gothwad Store` → **`Kiwi Store`** (short name `Kiwi`).
  The Gothwad ecosystem, Gothwad Accounts and the ecosystem app names
  (Browser, Manager, TV Launcher) are unchanged on owner instruction — only the
  store product itself was renamed.
- **Domains changed** (same Pages project, same Worker, same Supabase project):
  `store.` → `kiwistore.` · `console.` → `kiwiconsole.` ·
  `storeadmin.` → `kiwiadmin.` · `storeapp.` → `kiwiapp.`
  Migration checklist: `docs/KIWI_MIGRATION.md`.
- **Nothing is hardcoded any more.** `shared/brand.ts` is the single source of
  truth for the app name, the four site hosts and the Accounts URLs; it is
  imported by `src/lib/config.ts` (browser), `vite.config.ts` (fills the
  `%TOKEN%s` in `index.html` and generates `manifest.json`) and
  `worker/src/index.ts` (CORS origins + user-facing strings). Change a domain
  or the name with env variables only: `VITE_APP_DOMAIN` / `VITE_APP_NAME` on
  Pages, `APP_DOMAIN` / `APP_NAME` / `*_HOST` on the Worker.
- **`public/manifest.json` was deleted** — `manifest.json` is now generated at
  build time (and served by the dev server) from the brand config, so the PWA
  name follows `VITE_APP_NAME`.
- **OAuth `client_id` renamed** `gothwad-store` → `kiwi-store`; the Accounts
  `ecosystem_apps` row must be updated with the new id and the four new
  redirect URIs (`docs/KIWI_MIGRATION.md` step 4).
- Verified: `npm run lint`, `npm run build` (dist/index.html + dist/manifest.json
  checked) and `npm test` — 26 tests, including the new `tests/brand-config.test.mjs`
  which fails if any production URL or brand string is hardcoded again.

### 4.10 Session 3b (2026-10-18) — `kiwiapp` host + UI design-system pass

- **Store App domain:** `kiwistoreapp.gothwadtech.com` → **`kiwiapp.gothwadtech.com`**
  (owner decision; `DEFAULT_SITE_HOSTS.storeapp` + `STOREAPP_HOST` + docs).
- **Design system:** `src/shared/ui.tsx` ab chaaro surfaces ka single UI layer hai —
  `Button` (5 variants), `Card`, `PageHeader`, `StatCard`, `Tabs`, `Sheet` (mobile
  drawer), `EmptyState`, `Skeleton`, `Pill`, `Avatar`, `AccountMenu`, `SiteFooter`,
  `useToast`. Console/Admin ke local `Card`/`PageHeader`/`StatCard` copies hat gaye.
- **Responsive pass:** Store me desktop nav + mobile bottom bar (active pill),
  account dropdown (pehle avatar click = instant sign-out tha), rails par
  scroll-snap, skeletons, sticky mobile install bar, footer. Console/Admin me
  hamburger + `Sheet` drawer, tables ka mobile card view, `alert()` → toast.
  Landing (kiwiapp) par sticky header, mobile sticky download bar.
- **`src/index.css`:** focus-visible rings, thin scrollbars, `.panel`, `.rail`,
  `.safe-bottom`, skeleton shimmer, fade/toast animations, `prefers-reduced-motion`.
- **New check:** `npm run test:ui` — `vite build` ke baad bundle ko jsdom me chala
  kar 8 surfaces (store, app detail, library, console dashboard/releases/stats,
  admin, landing) render karta hai aur mobile+desktop markers assert karta hai
  (devDependency: `jsdom`).

## 5. How To Run It Locally

```bash
npm install
npm run worker:dev          # terminal 1 — Worker on http://127.0.0.1:8787
npx vite --port=36161 --host=0.0.0.0 --strictPort   # terminal 2 — current preview port
# (npm run dev is the same app on port 3000; vite.config.ts proxies /api → 8787)
```

- Open `http://localhost:36161/?mode=store` — use the floating switcher
  (bottom center, non-production only) to jump between the four sites.
- Click **Demo** or **Explore demo mode** on localhost/preview to sign in as
  `pawan` (demo developer + admin) without a backend. Listings, local actions,
  and profile state persist in this browser; clear `kiwi-store-state-v1` and
  `gothwad-demo-user` to reset. Sample APK actions are simulations only and do
  not upload a file. On production domains the demo identity and seeded UI are
  gated off before the first render; real auth uses Gothwad Accounts.
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
1. Create the `kiwi-store` Supabase project (⚠️ free plan: 2 active
   projects per org — Accounts + Mail already exist; check org/plan first)
   and run `sql/01_StoreSchema.sql`.
2. Register the `kiwi-store` client in **Accounts'** `ecosystem_apps`
   (redirect URIs for all four `/auth/callback`s + localhost).
3. Create keys: ImgBB API key; GitHub fine-grained PAT for `storefiles`.
4. Cloudflare Pages: connect this repo (`npm run build` → `dist`), attach
   all four custom domains.
5. Worker `store`: fill `SUPABASE_URL` in `worker/wrangler.toml`,
   set the three secrets, add `/api/*` routes on all four domains, deploy.
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
   first, then console/admin) from local state to the Worker; map API responses
   to the existing `types.ts` shapes (the Android app depends on them too — do
   not rename fields casually).~~ (done; local sample fallback is intentionally
   retained only on non-production preview hosts.)
3. ~~**Real uploads:** wire console image uploads to `POST /api/uploads/image`
   (ImgBB) and APK flow to `/apk` (GitHub ≤50 MB via Worker) with live progress; persist returned URLs
   through the CRUD endpoints from step 1.
4. ~~**APK manifest parsing** in the Worker (`worker/src/apk.ts`):~~ (ban gaya hai —)
   best-effort extract package name, versionCode/name, min/target SDK and
   permissions from `AndroidManifest.xml` (APK = ZIP, binary XML); fall back
   to manual form fields; verify package matches the listing.
5. **Auth hardening pass:** confirm rotated Accounts cookies are forwarded
   correctly on all four subdomains against the live Accounts deployment
   (the Mail project hit this class of bug — signed-in loops — so test the
   real cookie SSO); add the returned-session diagnostic
   (401 only for a real Accounts 401; other failures surface as distinct
   5xx codes) like Mail does.
6. **Live end-to-end test** on a real Android phone, then update `TASK.md`.
7. **Reviews/statistics polish:** add rating-breakdown bars from real review
   counts. Console daily statistics now call the Worker `/stats` endpoint and
   display recorded download counts (no generated chart values).
8. **Android integration (separate repo):** replace `DummyStoreData` in
   `GothwadTech/storeapp` with this API (`https://kiwistore.gothwadtech.com/api`),
   mapping responses onto its existing `AppItem` fields; Android login uses
   the same `kiwi-store` OAuth client (add its redirect URI in Accounts).

### 6.3 Known limitations / risks (do not rediscover these)
- **Free tiers bite in specific places:** Supabase 500 MB DB / 1 GB
  storage / 2 active projects per org / 7-day inactivity pause; ImgBB is
  unlimited-ish but has no transforms or SLA (browser-side compression is
  load-bearing); GitHub Releases is a distribution mirror, not a sole copy
  (SHA-256 is stored per release; keep an independent backup outside this upload path);
  The Worker must keep absorbing provider failures with
  clear English errors rather than crashing pages.
- **Seed listings are demo fixtures, not production content.** They remain
  available only on localhost/non-production previews. Production host gating
  begins with empty frontend state and displays only live API results; if the
  catalog API is unconfigured/unavailable, production listings remain empty.
  SQL category rows are the canonical taxonomy, not sample app listings.
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
4. Domains, hosts and the app name come from **`shared/brand.ts`** (defaults) +
   env (`VITE_*` for Pages, `[vars]` for the Worker) via `src/lib/config.ts`.
   Never hardcode a production domain, host or brand string in a component, in
   `index.html`, or in the Worker — `tests/brand-config.test.mjs` fails if you
   do. And do not call `localhost` from browser code.
5. UI copy stays **US English**; theme stays **#212121**. Naye UI ke liye
   `src/shared/ui.tsx` ke primitives use karo (`Button`, `Card`, `PageHeader`,
   `StatCard`, `Tabs`, `EmptyState`, `Sheet`, `useToast`) — har page par apne
   button/card classes invent mat karo. Har surface phone aur desktop dono par
   test karo (`npm run test:ui`).
6. Git: work only on the session branch you were given; run §5 checks before
   pushing; keep commits descriptive. (`main` moves only through PRs.)
7. When in doubt about auth, copy `GothwadTech/accounts` `docs/OAUTH.md` —
   do not invent a new auth flow.

---

*End of handover. Next action: run the current lint, tests, and production build
for the preview-only demo/production-host correction. Then follow §6.1 for
owner-only deployment steps and continue with §6.2.*
