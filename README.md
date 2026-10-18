# 🥝 KIWI STORE

**Gothwad ecosystem ka app store** — Play Store jaisa web store, Play Console
jaisa developer console, aur admin panel. Ek hi repo, ek hi Cloudflare Pages
project, ek hi Worker, ek hi (alag) Supabase project.

| Site | Domain | Kya hai |
|------|--------|---------|
| 🛍️ Store | `kiwistore.gothwadtech.com` | Apps/games browse, search, download, reviews |
| 🧑‍💻 Developer Console | `kiwiconsole.gothwadtech.com` | App publish, listing, releases, stats |
| 🛡️ Admin | `kiwiadmin.gothwadtech.com` | Manual review queue, suspend, reports |
| 📱 Store App | `kiwiapp.gothwadtech.com` | Store Android app ka download page |

Android app alag repo [`GothwadTech/storeapp`](https://github.com/GothwadTech/storeapp)
me hai — backend (Worker API) **yehi** hai.

> **Naam aur domains code me hardcode nahi hain.** Defaults `shared/brand.ts` me hain
> aur env se override hote hain — Pages par `VITE_APP_NAME` / `VITE_APP_DOMAIN`,
> Worker par `APP_NAME` / `APP_DOMAIN` / `*_HOST`. Badalna ho to sirf variable
> badlo (`docs/KIWI_MIGRATION.md` §6).

## 📚 Docs

| File | Kya milega |
|------|-----------|
| [`HANDOVER.md`](HANDOVER.md) | 🤖 **Naya AI/session? SABSE PEHLE YEH PADHO** — poora context, pakke faisle, kya bana/baaki |
| [`PLAN.md`](PLAN.md) | Poora design — architecture, storage rules, phases |
| [`TASK.md`](TASK.md) | Live status — kya bana, kya baaki |
| [`docs/SETUP.md`](docs/SETUP.md) | Step-by-step deploy (Supabase → Accounts → Cloudflare) |
| [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) | Bahari developers: app publish kaise karein |
| [`docs/KIWI_MIGRATION.md`](docs/KIWI_MIGRATION.md) | 🥝 Gothwad Store → Kiwi Store: Pages/Worker/Accounts dashboard steps + future domain change |

## 🚀 Local dev

```bash
npm install
npm run dev            # → http://localhost:3000 (neeche 4-site switcher milega)
npm run worker:dev     # dusre terminal me → http://127.0.0.1:8787
```

Production login **Sign in with Gothwad** (Gothwad Accounts OAuth + PKCE —
`docs/SETUP.md` §2) se hota hai. Localhost aur non-production previews par
optional **Demo** sign-in, sample listings, and local-only actions remain
available for development. The apex and every subdomain under
`gothwadtech.com` are synchronously gated to empty/API-only initial state: no
demo buttons, fake identity, or seed
listings render there. If the production Worker/API is unavailable, the catalog
stays empty and the app shows its backend status.

## 💾 Storage ke pakke niyam

- **Images** (icon/screenshots/logo) → **ImgBB** sirf
- **APK ≤ 50 MB** → **GitHub** repo `GothwadTech/storefiles` (Releases)
- APKs over 50 MB are rejected before upload for a reliable, single-provider flow.
- **Supabase** → sirf database (500 MB metadata). Storage bucket **nahi** banta.

## 🧪 Checks

```bash
npm run lint    # tsc (frontend + worker)
npm test        # 26 tests - Worker API, demo gating, brand/domain config
npm run test:ui # build + jsdom me 8 surfaces render (mobile + desktop markers)
npm run build   # dist/index.html + dist/manifest.json brand config se bante hain
```

© 2026 Gothwad Tech · Made in India 🇮🇳
