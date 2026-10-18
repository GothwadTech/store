# 🗄️ sql/ — Supabase SQL files (pehle YEH padho)

Is folder ki files **Kiwi Store ke apne Supabase project** me chalti hain.
Accounts ya Mail ke Supabase me **kabhi mat chalana** — har app ka apna project hai.

---

## ▶️ Chalane ka tareeka (order fix hai)

1. Supabase Dashboard → apna `kiwi-store` project → **SQL Editor**
2. Files **number order** me ek-ek karke chalao: `01_...` → `02_...` → `03_...`
3. Jo file pehle chala chuke ho, use **dobara chalana safe hai** (neeche dekho)

| File | Kya karta hai |
|------|---------------|
| `01_StoreSchema.sql` | Saari core tables (developers, apps, releases, reviews…), RLS policies, categories seed |

---

## ♻️ Sabse bada niyam — har SQL IDEMPOTENT hogi

Har file is tarah likhi jayegi ki:

- ✅ **Fresh project** par pehli baar chalao → successful
- ✅ **Aadhi chali hui** file dobara chalao → jahan ruk gayi thi, wahan se poori ho jayegi, error nahi
- ✅ **Poori chali hui** file phir chalao → error nahi, aur agar file me kuch
  **update** hua hai (nayi column, badli policy, naya seed naam) to wo purane
  setup par **apply ho jayega**

Isiliye likhne ka pattern har jagah yahi rahega:

```sql
create table if not exists ...;                    -- pehle se hai to skip
alter table ... add column if not exists ...;      -- nayi column sirf tab, jab na ho
create index if not exists ...;
drop policy if exists "..." on ...;                -- policy pehle hatao, phir banao
create policy "..." ...;
insert ... on conflict (...) do update set ...;    -- seed dobara run par update ho
```

❌ Kabhi mat likho: bina `if not exists` ke `create table`, bina guard ke
`alter table ... add column`, ya aisa `insert` jo duplicate par error de.

---

## 📏 File size ka niyam — 01, 02, 03… aise badhega

- Ek SQL file lagbhag **600–1000 lines** tak hi rakho.
- Jab mojooda file us limit ke paas pahunche, usme aur mat ghusedo —
  **agli number wali nayi file** banao aur nayi SQL wahan jodte jao.
- Naam ka format hamesha: **`NN_NameOfSql.sql`**
  (do ank ka number + samajh aane wala naam), jaise:
  `01_StoreSchema.sql`, `02_AppAnalytics.sql`, `03_DeveloperTeams.sql`
- Number kabhi reuse/skip mat karo; purani file me gayab cheezein delete
  karne ki jagah **nayi file me** `alter`/`drop` statements likho, taaki
  purane setups par bhi wahi badlav order se lage.

## ➕ Nayi SQL jodte waqt (checklist)

- [ ] Sahi file chuni? (limit ke andar hai to wahi file, warna agli number wali nayi)
- [ ] Har statement idempotent hai? (upar wala pattern)
- [ ] Is README ki table me nayi file ki ek line jod di?
- [ ] Fresh + pehle se chale hue dono tarah ke project par socha?

