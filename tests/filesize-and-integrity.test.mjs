import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { importTs } from './helpers/ts.mjs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.wrangler']);
const CHECK_EXTS = new Set(['.ts', '.tsx', '.mjs', '.js', '.sql', '.toml', '.md', '.css']);

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.');
      const ext = dot >= 0 ? entry.name.slice(dot) : '';
      if (CHECK_EXTS.has(ext) || entry.name.startsWith('.env') || entry.name.startsWith('.dev.vars')) {
        files.push(full);
      }
    }
  }
  return files;
}

test('every code, SQL, test, and markdown file in the repository is <= 500 lines', async () => {
  const files = await walkFiles(rootDir);
  const violations = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');
    const count = content.endsWith('\n') ? lines.length - 1 : lines.length;
    if (count > 500) {
      violations.push(`${relative(rootDir, file)} (${count} lines)`);
    }
  }
  assert.deepEqual(violations, [], `Files exceeding 500 lines:\n${violations.join('\n')}`);
});

test('package.json pins TypeScript 5.8.x so tsc binary is always available in npm ci', async () => {
  const pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'));
  assert.match(String(pkg.devDependencies?.typescript ?? ''), /^\^5\.8\./);
});

test('worker/wrangler.toml wires active routes for all 4 domains, exact D1 store database_id, keep_vars = true, and zero R2 buckets', async () => {
  const wrangler = await readFile(join(rootDir, 'worker/wrangler.toml'), 'utf8');
  assert.match(wrangler, /\[\[d1_databases\]\]/);
  assert.match(wrangler, /binding\s*=\s*"DB"/);
  assert.match(wrangler, /database_name\s*=\s*"store"/);
  assert.match(wrangler, /database_id\s*=\s*"a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"/);
  assert.match(wrangler, /keep_vars\s*=\s*true/);
  assert.match(wrangler, /routes\s*=\s*\[/);
  for (const host of ['kiwistore', 'kiwiconsole', 'kiwiadmin', 'kiwiapp']) {
    assert.match(
      wrangler,
      new RegExp(`pattern\\s*=\\s*"${host}\\.gothwadtech\\.com\\/api\\/\\*"[^}]*zone_name\\s*=\\s*"gothwadtech\\.com"`),
    );
  }
  assert.doesNotMatch(wrangler, /r2_buckets|SUPABASE|IMGBB/i);
});

test('sql/00_d1_console_bootstrap.sql has zero comments and zero PRAGMA statements', async () => {
  const bootstrap = await readFile(join(rootDir, 'sql/00_d1_console_bootstrap.sql'), 'utf8');
  const schema = await readFile(join(rootDir, 'sql/01_store_schema.sql'), 'utf8');
  assert.doesNotMatch(bootstrap, /--/);
  assert.doesNotMatch(bootstrap, /\/\*/);
  assert.doesNotMatch(bootstrap, /\bPRAGMA\b/i);
  assert.doesNotMatch(schema, /\bPRAGMA\b/i);
});

test('zero Supabase, ImgBB, or R2 references in runtime code and env templates', async () => {
  const targets = [
    ...(await walkFiles(join(rootDir, 'src'))),
    ...(await walkFiles(join(rootDir, 'worker'))),
    ...(await walkFiles(join(rootDir, 'shared'))),
    join(rootDir, 'package.json'),
    join(rootDir, '.env.example'),
  ];
  const violations = [];
  for (const file of targets) {
    const content = await readFile(file, 'utf8');
    if (/supabase|imgbb|postgrest|r2_buckets/i.test(content)) {
      violations.push(relative(rootDir, file));
    }
  }
  assert.deepEqual(violations, [], `Found forbidden legacy references in: ${violations.join(', ')}`);
});

test('frontend src/ never stores OAuth access_token or refresh_token in localStorage or sessionStorage', async () => {
  const srcFiles = await walkFiles(join(rootDir, 'src'));
  for (const file of srcFiles) {
    const content = await readFile(file, 'utf8');
    assert.doesNotMatch(
      content,
      /(localStorage|sessionStorage)\.(setItem|getItem)\([^)]*(token|access_token|refresh_token)/i,
      `Found token storage in ${relative(rootDir, file)}`,
    );
  }
});

test('web auth uses direct first-party /signin?next=, silent Accounts SSO fallback, and Universal Account Menu', async (t) => {
  const authSource = await readFile(join(rootDir, 'src/lib/auth.ts'), 'utf8');
  const apiSource = await readFile(join(rootDir, 'src/lib/api.ts'), 'utf8');
  const menuSource = await readFile(join(rootDir, 'src/shared/AccountMenu.tsx'), 'utf8');
  const fallbackSource = await readFile(join(rootDir, 'src/shared/gothwadAccountMenuFallback.ts'), 'utf8');

  assert.doesNotMatch(authSource, /\/oauth\/authorize/);
  assert.doesNotMatch(authSource, /from '\.\/router'/);
  assert.match(authSource, /\/signin/);
  assert.match(authSource, /\/widget\/account-menu\.js/);
  assert.match(authSource, /\/api\/auth\/me/);
  assert.match(apiSource, /fetchDirectAccountsSession/);
  assert.match(menuSource, /ensureGothwadAccountMenu/);
  assert.match(menuSource, /resolveSignOutSlotId/);
  assert.match(menuSource, /extraAccountCount > 0/);
  assert.match(fallbackSource, /GothwadAccountMenu/);

  const srcFiles = await walkFiles(join(rootDir, 'src'));
  for (const file of srcFiles) {
    const content = await readFile(file, 'utf8');
    assert.doesNotMatch(content, /Sign in with Gothwad/i, `Found third-party Sign in with Gothwad copy in ${relative(rootDir, file)}`);
  }

  // Verify direct browser silent SSO normalization + per-slot signout contract
  const {
    normalizeClientUser,
    normalizeClientAccounts,
    resolveSignOutSlotId,
    signOutAccountSlot,
  } = await importTs('src/lib/auth.ts');

  const user = normalizeClientUser({
    id: 'u-1',
    username: 'Pawan',
    firstName: 'Pawan',
    lastName: 'Gothwad',
    avatarUrl: 'https://accounts.gothwadtech.com/avatar/pawan.webp',
  });
  assert.equal(user.username, 'pawan');
  assert.equal(user.name, 'Pawan Gothwad');
  assert.equal(user.email, 'pawan@gothwadtech.com');
  assert.equal(user.avatarUrl, 'https://accounts.gothwadtech.com/avatar/pawan.webp');

  const slots = normalizeClientAccounts(
    [
      { id: 'slot-0', authuser: 0, username: 'pawan', firstName: 'Pawan', lastName: 'Gothwad' },
      { id: 'slot-1', authuser: 1, username: 'dev', firstName: 'Dev', lastName: 'Team' },
    ],
    'slot-1',
  );
  assert.equal(slots.length, 2);
  assert.equal(slots[0].active, false);
  assert.equal(slots[1].active, true);
  assert.equal(slots[1].authuser, 1);

  // Verify onSignOutAccount("b") resolves "b" from primitive string OR account object,
  // calls /api/auth/accounts/b/signout, and NEVER calls /api/auth/signout.
  assert.equal(resolveSignOutSlotId('b'), 'b');
  assert.equal(resolveSignOutSlotId({ id: 'b' }), 'b');
  assert.equal(resolveSignOutSlotId(null, { id: 'slot-2' }), 'slot-2');
  assert.equal(resolveSignOutSlotId(undefined), null);

  const calledUrls = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    calledUrls.push(String(input));
    return Response.json({ ok: true });
  });

  const signedOutB = await signOutAccountSlot('b');
  assert.equal(signedOutB, true);
  assert.deepEqual(calledUrls, ['/api/auth/accounts/b/signout']);

  const signedOutEmpty = await signOutAccountSlot(undefined);
  assert.equal(signedOutEmpty, false);
  assert.deepEqual(calledUrls, ['/api/auth/accounts/b/signout']);
});

test('all code, comments, SQL, and markdown documentation are written in 100% pure English', async () => {
  const files = await walkFiles(rootDir);
  const hinglishPattern = /\b(hai|hain|bina|apne|karein|hota|hoti|nahi|sirf|jaata|chahe|kisi|kabhi|bhi|dono|zaroor|kyunki|taaki)\b/i;
  const violations = [];
  for (const file of files) {
    if (relative(rootDir, file) === 'tests/filesize-and-integrity.test.mjs') continue;
    const content = await readFile(file, 'utf8');
    if (hinglishPattern.test(content)) {
      violations.push(relative(rootDir, file));
    }
  }
  assert.deepEqual(violations, [], `Found non-English / Hinglish text in: ${violations.join(', ')}`);
});
