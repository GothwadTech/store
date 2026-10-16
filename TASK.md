# 📋 TASK.md — Gothwad Store live status

**Last updated:** 2026-10-16 (Session 2) · New session? Pehle [`HANDOVER.md`](HANDOVER.md) padho · Plan: [`PLAN.md`](PLAN.md) · Deploy: [`docs/SETUP.md`](docs/SETUP.md)

## ✅ Ho gaya (Session 1 — 2026-10-16)

- [x] PLAN.md — poora design (Accounts/Mail pattern par)
- [x] Repo skeleton — Vite + React 19 + TS + Tailwind 4 (Mail stack)
- [x] **Store** (`store.*`) — Play-look home, Apps/Games, search, category, charts,
      app detail (screenshots/reviews/wishlist/download), library, developer page
- [x] **Developer Console** (`console.*`) — onboarding, dashboard, create app
      (package unique check), listing editor (ImgBB images), APK release upload
      (≤25MB → GitHub / >25MB → B2 rule auto), submit-for-review, stats, review reply
- [x] **Admin** (`storeadmin.*`) — manual review queue (approve/reject+note),
      all-apps suspend/restore, user reports. Sirf `ADMIN_USERNAMES` wale
- [x] **StoreApp landing** (`storeapp.*`) — Store Android app download page + QR
- [x] Ek SPA, hostname se shell switch; preview/local me neeche mode-switcher
- [x] Auth — "Sign in with Gothwad" PKCE flow + Worker `/api/me` (cookie/Bearer);
      preview me Demo login (production host par demo button nahi)
- [x] Worker `store` (`worker/`) — health, me, OAuth exchange, public store API,
      download counter+redirect, ImgBB image upload, APK ticket
      (GitHub worker-upload / B2 presigned PUT), GitHub Releases upload
- [x] Supabase SQL `sql/01_StoreSchema.sql` — 12 tables + RLS + categories
      (Storage bucket NAHI banta — pakka faisla)
- [x] `npm run build` + worker typecheck saaf

## ✅ Session 2 (2026-10-16) — Admin domain + asli backend wiring

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
      Backend unconfigured mile to seed + localStorage demo mode hi fallback
      hai. Console ke image uploads `/api/uploads/image` (ImgBB) se, APK flow
      `apk-ticket`/`apk` (≤25MB GitHub, >25MB B2 presigned direct, progress
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

## 🔜 Agla (owner ke human steps pehle — docs/SETUP.md)

- [ ] Supabase project `gothwad-store` banao → SQL chalao → keys Worker me
- [ ] Accounts ke `ecosystem_apps` me `gothwad-store` register karo (SETUP §2;
      chaaro `/auth/callback` redirect URIs, admin wala
      `https://storeadmin.gothwadtech.com/auth/callback` sahit)
- [ ] GitHub repo `GothwadTech/store-files` (owner bana raha hai) + PAT
- [ ] Backblaze B2 bucket + key · ImgBB API key
- [ ] Cloudflare: Pages project (4 custom domains) + Worker `store` (4 routes)
- [ ] Live test: console upload → admin approve → store download → phone install
- [ ] Auth hardening: asli Accounts cookie SSO chaaro subdomains par test
- [ ] `storeapp` (Android) me DummyStoreData hata kar yahi API lagao
