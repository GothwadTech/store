import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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

test('worker/wrangler.toml wires exact D1 store database_id, keep_vars = true, and zero R2 buckets', async () => {
  const wrangler = await readFile(join(rootDir, 'worker/wrangler.toml'), 'utf8');
  assert.match(wrangler, /\[\[d1_databases\]\]/);
  assert.match(wrangler, /binding\s*=\s*"DB"/);
  assert.match(wrangler, /database_name\s*=\s*"store"/);
  assert.match(wrangler, /database_id\s*=\s*"a3dc3e71-cf89-4e0a-89d1-693fcf6f227a"/);
  assert.match(wrangler, /keep_vars\s*=\s*true/);
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
