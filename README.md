# 🥝 KIWI STORE

**Gothwad ecosystem ka app store** — Play Store jaisa web store, Play Console
jaisa developer console, aur admin panel. Ek hi repo, ek hi Cloudflare Pages
project, ek hi Worker, aur ek **100% Zero-Card Cloudflare D1** SQLite database
(`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`).

| Site | Domain | Kya hai |
|------|--------|---------|
| 🛍️ Store | `store.gothwadtech.com` | Apps/games browse, search, download, reviews |
| 🧑‍💻 Developer Console | `storeconsole.gothwadtech.com` | App publish, listing, releases, stats |
| 🛡️ Admin | `storeadmin.gothwadtech.com` | Manual review queue, suspend, reports, audit log |
| 📱 Store App | `storeapp.gothwadtech.com` | Store Android app ka download page |

Android app alag repo [`GothwadTech/storeapp`](https://github.com/GothwadTech/storeapp)
me hai — backend (Worker API) **yehi** hai.

> **Naam aur domains code me hardcode nahi hain.** Defaults `shared/brand.ts` me hain
> aur env se override hote hain — Pages par `VITE_APP_NAME` / `VITE_APP_DOMAIN`,
> Worker par `APP_NAME` / `APP_DOMAIN` / `*_HOST`. Badalna ho to sirf variable
> badlo (`docs/KIWI_MIGRATION.md` §6).

## 📚 Docs

| File | Kya milega |
|------|-----------|
| [`HANDOVER.md`](HANDOVER.md) | 🤖 **Naya AI/session? SABSE PEHLE YEH PADHO** — poora context, D1 architecture, multi-account SSO |
| [`PLAN.md`](PLAN.md) | Poora design — D1 schema, Edge Cache CDN, storage rules, phases |
| [`TASK.md`](TASK.md) | Live status — kya bana, kya baaki |
| [`docs/SETUP.md`](docs/SETUP.md) | Step-by-step deploy (Cloudflare D1 → Accounts → Pages → Worker) |
| [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) | Bahari developers: app publish kaise karein |
| [`docs/KIWI_MIGRATION.md`](docs/KIWI_MIGRATION.md) | 🥝 Store D1 + Brand / Domain dashboard steps |

## 🚀 Local dev

```bash
npm install
npm run dev            # → http://localhost:3000 (neeche 4-site switcher milega)
npm run worker:dev     # dusre terminal me → http://127.0.0.1:8787 (local D1 SQLite)
```

Production login **Sign in with Gothwad** (`.gothwadtech.com` HttpOnly SSO
cookies + `/u/0..5` multi-account switcher + OAuth PKCE fallback via
`https://api.gothwadtech.com`) se hota hai. Localhost aur non-production
previews par optional **Demo** sign-in, sample listings, and local-only actions
remain available for development. The apex and every subdomain under
`gothwadtech.com` are synchronously gated to empty/API-only initial state: no
demo buttons, fake identity, or seed listings render there.

## 💾 Storage ke pakke niyam (100% Zero-Card)

- **Database**: **Cloudflare D1** (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`) — 13 SQLite tables. Zero Supabase.
- **Images** (icon/screenshots/banner): Client-side Canvas WebP (`≤ 380 KB`) → **D1 `store_images` BLOB** + **Cloudflare Edge Cache (`caches.default`)** served from `https://store.gothwadtech.com/api/images/:id` (`Cache-Control: public, max-age=31536000, immutable` + `ETag`). Zero ImgBB, Zero R2.
- **APK ≤ 50 MB**: **GitHub** repo `GothwadTech/storefiles` (Releases) via Worker upload.

## 🧪 Checks

```bash
npm run lint    # tsc --noEmit (frontend + worker)
npm test        # node --test (LocalD1Database SQLite + Worker API + SSO + Image CDN + <=500 line guard)
npm run test:ui # build + jsdom me 8 surfaces render (mobile + desktop markers)
npm run build   # dist/index.html + dist/manifest.json brand config se bante hain
```

© 2026 Gothwad Tech · Made in India 🇮🇳
