# 📋 TASK.md — Gothwad Store live status

**Last updated:** 2026-10-16 (console reliability pass: GitHub-only APK uploads, 50 MB cap, guided publishing) · New session? Pehle [`HANDOVER.md`](HANDOVER.md) padho · Plan: [`PLAN.md`](PLAN.md) · Deploy: [`docs/SETUP.md`](docs/SETUP.md)

## ✅ Ho gaya (Session 1 — 2026-10-16)

- [x] PLAN.md — poora design (Accounts/Mail pattern par)
- [x] Repo skeleton — Vite + React 19 + TS + Tailwind 4 (Mail stack)
- [x] **Store** (`store.*`) — Play-look home, Apps/Games, search, category, charts,
      app detail (screenshots/reviews/wishlist/download), library, developer page
- [x] **Developer Console** (`console.*`) — onboarding, dashboard, create app
      (package unique check), listing editor (ImgBB images), APK release upload
      (GitHub storefiles, ≤50MB, live byte progress), submit-for-review, stats, review reply
- [x] **Admin** (`storeadmin.*`) — manual review queue (approve/reject+note),
      all-apps suspend/restore, user reports. Sirf `ADMIN_USERNAMES` wale
- [x] **StoreApp landing** (`storeapp.*`) — Store Android app download page + QR
- [x] Ek SPA, hostname se shell switch; preview/local me neeche mode-switcher
- [x] Auth — "Sign in with Gothwad" PKCE flow + Worker `/api/me` (cookie/Bearer);
      optional local/preview demo account is host-gated off all production domains
- [x] Worker `store` (`worker/`) — health, me, OAuth exchange, public store API,
      download counter+redirect, resilient ImgBB image upload, GitHub Releases APK upload (≤50MB)
- [x] Supabase SQL `sql/01_StoreSchema.sql` — 12 tables + RLS + categories
      (Storage bucket NAHI banta — pakka faisla)
- [x] `npm run build` + worker typecheck saaf

## ✅ Session 2 (2026-10-16) — Admin domain + asli backend wiring

- [x] **APK GitHub repo ka naam theek kiya:** asal repo naam `storefiles` hai
      (bina dash ke) — `GITHUB_FILES_REPO = "storefiles"` (wrangler.toml)
      sahit codebase ke saare repo-name references `store-files` →
      `storefiles`. (File paths/technical dashes ko haath nahi lagaya;
      `sql/` me repo naam tha hi nahi — wahan provider value `github` hai.)
- [x] **Admin domain badla:** purana two-level admin domain →
      `storeadmin.gothwadtech.com` har jagah (config.ts hostname detection +
      SITE_URLS, wrangler.toml ADMIN_URL + routes, saari docs). Chaaro final
      domains: `store` · `console` · `storeadmin` · `storeapp` (sab one-level,
      free Universal SSL kaafi — Total TLS nahi chahiye)
- [x] **Worker CRUD live (code):** `/api/dev/*` (register, apps CRUD + listing
      + screenshots, releases, submit, stats, review reply) aur `/api/admin/*`
      (queue, approve/reject+note, suspend/restore, feature, reports) —
      `sql/01_StoreSchema.sql` ki tables par, ownership/package-uniqueness/
      version-code/reject-note/download-dedupe rules Worker me. 501 gaya.
      Saath me user actions: review likhna (1 user = 1 review), wishlist,
      library, report — Worker responses `types.ts` shapes me map hote hain
- [x] **Frontend ↔ API wiring:** naya `src/lib/api.ts`; `AppContext` ab
      Worker se hydrate hota hai (catalog → session/dev/admin bundles).
      Production backend unconfigured/unavailable ho to empty catalog + clear
      status notice dikhta hai; local/preview retains sample data and demo-only
      local persistence. Console ke image uploads `/api/uploads/image` (ImgBB) se, APK flow
      `/apk` (GitHub-only, ≤50MB, progress
      ke saath) se jud gaya
- [x] **APK manifest auto-read:** `worker/src/apk.ts` — ZIP + binary
      AndroidManifest.xml se package/versionCode/versionName/min/target SDK/
      permissions + SHA-256; console form auto-fill, package mismatch par
      Worker 400. Synthetic APK (stored + deflated) se test pass
- [x] `public/_redirects` SPA fallback (andar ke pages refresh par 404 nahi)
- [x] Store ke ek bache hue Hinglish UI string ko US English kiya
- [x] Verify: `npm run build` + worker typecheck pass; mock Supabase/Accounts
      ke against poora E2E (register→create→release→submit→reject→resubmit→
      approve→store→review/reply→wishlist/report→download dedupe→stats) pass

## ✅ Draft listing save fix (2026-10-16)

- [x] Worker listing PATCH me current status ke barabar bheja gaya status no-op
      hai; guard sirf actual transition par lagta hai. Bina live release ke
      `draft → published` ab bhi reject hota hai.
- [x] Console listing-save ab sirf editable listing fields + screenshots bhejta
      hai, poora app/status nahi. Publish/Unpublish ka alag flow unchanged hai.
- [x] `npm test` regression suite (Node 22.13+): Draft listing without status /
      same status saves; in-review/published same-status saves; unauthorized
      status transitions aur publish without live release reject hote hain.
      Accounts/Supabase mocked hain; production services ki zaroorat nahi.
- [x] Verify: `npm test` (6 tests), `npm run build`, aur
      `npx tsc -p worker/tsconfig.json --noEmit` pass.

## ✅ Session 3 (2026-10-16) — Preview-only demo; production stays API-only

- [x] Retained seeded apps/reviews/submissions/reports, local persistence, demo
      sign-in, and simulated preview actions on localhost/non-production previews.
- [x] Synchronously gates seed state, demo identity, demo buttons, preview
      notices, and the mode switcher by hostname before React's first render;
      the apex and every `*.gothwadtech.com` host start empty and use Gothwad auth only.
- [x] Production backend unconfigured/unavailable stays empty/API-only; write
      actions cannot silently fall back to local state. Preview demo writes stay
      local and do not upload APKs or alter the live GitHub upload flow.
- [x] Real API statistics/download behavior in production and explicit backend
      status notices; only the local demo uses labeled illustrative stats.
      Sample APK URLs stay blank.
- [x] Worker blocks developers from restoring suspended apps and blocks direct
      downloads of pending releases or releases whose app is not published.
- [x] Verified corrected tree: `npm run lint`, `npm test` (12 tests), and
      `npm run build` pass.

## 🔎 Review findings / potential improvements

- [ ] Add fetch timeouts/abort handling and distinguish auth network/5xx errors
      from a genuine signed-out session; a stalled Worker request can leave
      initial loading open-ended.
- [ ] Validate/version the preview `localStorage` state shape and cap or move
      image data URLs (screenshots) to IndexedDB to avoid corrupted state or
      quota-related loss.
- [ ] Add a browser-level regression test that opens production-host mode
      with stale demo storage and verifies no demo UI on the first paint; the
      current regression test checks the synchronous guards statically.
- [ ] After owner-only service setup, smoke-test Accounts cookie/OAuth, live
      catalog, ImgBB, and GitHub uploads end-to-end.

## 🔜 Agla (owner ke human steps pehle — docs/SETUP.md)

- [ ] Supabase project `gothwad-store` banao → SQL chalao → keys Worker me
- [ ] Accounts ke `ecosystem_apps` me `gothwad-store` register karo (SETUP §2;
      chaaro `/auth/callback` redirect URIs, admin wala
      `https://storeadmin.gothwadtech.com/auth/callback` sahit)
- [ ] GitHub repo `GothwadTech/storefiles` (owner bana raha hai) + PAT
- [ ] ImgBB API key · GitHub storefiles fine-grained token
- [ ] Cloudflare: Pages project (4 custom domains) + Worker `store` (4 routes)
- [ ] Live test: console upload → admin approve → store download → phone install
- [ ] Auth hardening: asli Accounts cookie SSO chaaro subdomains par test
- [ ] `storeapp` (Android) me DummyStoreData hata kar yahi API lagao
