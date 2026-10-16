# 🛍️ GOTHWAD STORE

**Gothwad ecosystem ka app store** — Play Store jaisa web store, Play Console
jaisa developer console, aur admin panel. Ek hi repo, ek hi Cloudflare Pages
project, ek hi Worker, ek hi (alag) Supabase project.

| Site | Domain | Kya hai |
|------|--------|---------|
| 🛍️ Store | `store.gothwadtech.com` | Apps/games browse, search, download, reviews |
| 🧑‍💻 Developer Console | `console.gothwadtech.com` | App publish, listing, releases, stats |
| 🛡️ Admin | `storeadmin.gothwadtech.com` | Manual review queue, suspend, reports |
| 📱 Store App | `storeapp.gothwadtech.com` | Store Android app ka download page |

Android app alag repo [`GothwadTech/storeapp`](https://github.com/GothwadTech/storeapp)
me hai — backend (Worker API) **yehi** hai.

## 📚 Docs

| File | Kya milega |
|------|-----------|
| [`HANDOVER.md`](HANDOVER.md) | 🤖 **Naya AI/session? SABSE PEHLE YEH PADHO** — poora context, pakke faisle, kya bana/baaki |
| [`PLAN.md`](PLAN.md) | Poora design — architecture, storage rules, phases |
| [`TASK.md`](TASK.md) | Live status — kya bana, kya baaki |
| [`docs/SETUP.md`](docs/SETUP.md) | Step-by-step deploy (Supabase → Accounts → Cloudflare) |
| [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) | Bahari developers: app publish kaise karein |

## 🚀 Local dev

```bash
npm install
npm run dev            # → http://localhost:3000 (neeche 4-site switcher milega)
npm run worker:dev     # dusre terminal me → http://127.0.0.1:8787
```

Login bina backend ke test karne ke liye **Demo mode** button hai (sirf
local/preview par dikhta hai). Asli login = **Sign in with Gothwad**
(Gothwad Accounts OAuth + PKCE — `docs/SETUP.md` §2 dekho).

## 💾 Storage ke pakke niyam

- **Images** (icon/screenshots/logo) → **ImgBB** sirf
- **APK ≤ 25 MB** → **GitHub** repo `GothwadTech/store-files` (Releases)
- **APK > 25 MB** → **Backblaze B2**
- **Supabase** → sirf database (500 MB metadata). Storage bucket **nahi** banta.

© 2026 Gothwad Tech · Made in India 🇮🇳
