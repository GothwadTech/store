# 📋 TASK.md — Gothwad Store live status

**Last updated:** 2026-10-16 · New session? Pehle [`HANDOVER.md`](HANDOVER.md) padho · Plan: [`PLAN.md`](PLAN.md) · Deploy: [`docs/SETUP.md`](docs/SETUP.md)

## ✅ Ho gaya (Session 1 — 2026-10-16)

- [x] PLAN.md — poora design (Accounts/Mail pattern par)
- [x] Repo skeleton — Vite + React 19 + TS + Tailwind 4 (Mail stack)
- [x] **Store** (`store.*`) — Play-look home, Apps/Games, search, category, charts,
      app detail (screenshots/reviews/wishlist/download), library, developer page
- [x] **Developer Console** (`console.*`) — onboarding, dashboard, create app
      (package unique check), listing editor (ImgBB images), APK release upload
      (≤25MB → GitHub / >25MB → B2 rule auto), submit-for-review, stats, review reply
- [x] **Admin** (`admin.console.*`) — manual review queue (approve/reject+note),
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

## 🔜 Agla (owner ke human steps pehle — docs/SETUP.md)

- [ ] Supabase project `gothwad-store` banao → SQL chalao → keys Worker me
- [ ] Accounts ke `ecosystem_apps` me `gothwad-store` register karo (SETUP §2)
- [ ] GitHub repo `GothwadTech/store-files` (owner bana raha hai) + PAT
- [ ] Backblaze B2 bucket + key · ImgBB API key
- [ ] Cloudflare: Pages project (4 custom domains) + Worker `store` (4 routes)
- [ ] Worker ke `/api/dev/*` + `/api/admin/*` CRUD ko Supabase se jodo
      (abhi frontend local state par hai; Worker me 501 placeholder hai)
- [ ] Frontend ko Worker API se jodo (abhi seed/local state; API client agla step)
- [ ] APK manifest auto-read (package/version/permissions) — Worker `apk.ts`
- [ ] Live test: console upload → admin approve → store download → phone install
- [ ] `storeapp` (Android) me DummyStoreData hata kar yahi API lagao
