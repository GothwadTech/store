# Kiwi Store — Cloudflare D1 SQLite Migrations (`sql/`)

This directory contains the idempotent SQLite migrations and official Gothwad ecosystem seeds for the **Kiwi Store** **Cloudflare D1** database (`store`, `a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`).

## Files

| File | Purpose |
|---|---|
| `00_d1_console_bootstrap.sql` | Pure idempotent SQL (zero `--` comments, zero `PRAGMA` statements) designed for direct copy-paste execution in the **Cloudflare Dashboard D1 Console**. |
| `01_store_schema.sql` | Documented schema, category seeds, and official ecosystem app seeds for Wrangler CLI (`npx wrangler d1 execute store --remote --file=sql/01_store_schema.sql`). |

## Cold-Start Auto-Bootstrap

The Worker (`worker/src/db.ts` -> `ensureSchema(env.DB)`) automatically bootstraps all 13 tables, indexes, 12 categories, and 5 official Gothwad ecosystem apps (`CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE`) on its first request.

For manual bootstrap or verification:

### Option A — Cloudflare Dashboard D1 Console
1. Open Cloudflare Dashboard → **Workers & Pages** → **D1 SQL database** → **`store`** (`a3dc3e71-cf89-4e0a-89d1-693fcf6f227a`).
2. In the **Console** tab, paste the entire contents of `sql/00_d1_console_bootstrap.sql` and click **Execute**.

### Option B — Wrangler CLI
```bash
cd worker
npx wrangler d1 execute store --remote --file=../sql/01_store_schema.sql
```

## Important Rules
- Never place `PRAGMA` statements in D1 SQL files or runtime queries (Cloudflare D1 remote batch execution rejects `PRAGMA` with `SQLITE_AUTH`).
- Keep `00_d1_console_bootstrap.sql` completely free of `--` or `/* */` comments.
- Keep every migration idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT OR IGNORE`).
