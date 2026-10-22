# Kiwi Store — Cloudflare D1 SQLite Migrations (`sql/`)

Is folder me **Kiwi Store** ke **Cloudflare D1 (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`)** ke idempotent SQLite migrations aur official Gothwad ecosystem seeds hain.

## Files

| File | Kaam |
|---|---|
| `00_d1_console_bootstrap.sql` | **Cloudflare Dashboard D1 Console** me seedha copy-paste karne ke liye 100% pure idempotent SQL (zero `--` comments, zero `PRAGMA`). |
| `01_store_schema.sql` | Wrangler CLI (`npx wrangler d1 execute store --remote --file=sql/01_store_schema.sql`) ke liye documented schema + category + ecosystem seeds. |

## Cold-Start Auto-Bootstrap

Worker (`worker/src/db.ts` -> `ensureSchema(env.DB)`) pehli request aane par automatically saari 13 tables, indexes, 12 categories aur 5 official Gothwad ecosystem apps (`CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE`) bootstrap kar deta hai.

Fir bhi manual bootstrap ya verification ke liye:

### Option A — Cloudflare Dashboard D1 Console
1. Cloudflare Dashboard → **Workers & Pages** → **D1 SQL database** → **`store`** (`a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`) kholo.
2. **Console** tab me `sql/00_d1_console_bootstrap.sql` poora paste karke **Execute** daba do.

### Option B — Wrangler CLI
```bash
cd worker
npx wrangler d1 execute store --remote --file=../sql/01_store_schema.sql
```

## Important Rules
- D1 SQL files ya runtime queries me kabhi `PRAGMA` mat daalo (Cloudflare D1 remote batch `SQLITE_AUTH` deta hai).
- `00_d1_console_bootstrap.sql` me koi `--` ya `/* */` comment nahi hona chahiye.
- Har migration idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT OR IGNORE`) hona chahiye.
