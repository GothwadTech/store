import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLocalD1 } from '../tools/local-d1.mjs';
import { moduleUrl } from './helpers/ts.mjs';

const workerUrl = await moduleUrl('worker/src/index.ts');
const { default: worker } = await import(workerUrl);
const bootstrapSql = await readFile(new URL('../sql/00_d1_console_bootstrap.sql', import.meta.url), 'utf8');

test('empty non-null listing fields stay empty strings in D1 instead of failing NOT NULL constraints', async (t) => {
  const DB = createLocalD1();
  await DB.exec(bootstrapSql);
  await DB.prepare(
    `INSERT INTO developers (id, user_id, username, display_name, org_name, support_email)
     VALUES ('dev-test', 'user-test', 'tester', 'Tester', 'Tester', 'dev@example.test')`,
  ).run();
  await DB.prepare(
    `INSERT INTO apps (
      id, developer_id, package_name, name, status, category, kind,
      short_desc, full_desc, icon_url, support_email
    ) VALUES (
      'app-test', 'dev-test', 'com.example.app', 'Example', 'draft', 'tools', 'app',
      'Before', 'Before', 'https://image.test/icon.webp', 'dev@example.test'
    )`,
  ).run();

  const env = { DB, AUTH_HUB_URL: 'https://accounts.test', ADMIN_USERNAMES: '' };
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/userinfo')) {
      return Response.json({ sub: 'user-test', preferred_username: 'tester' });
    }
    assert.fail(`Unexpected fetch: ${url.href}`);
  });

  const response = await worker.fetch(
    new Request('https://console.test/api/dev/apps/app-test', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortDesc: '', fullDesc: '', iconUrl: '', supportEmail: '' }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.app.shortDesc, '');
  assert.equal(body.app.fullDesc, '');
  assert.equal(body.app.iconUrl, '');
  assert.equal(body.app.supportEmail, '');

  const row = await DB.prepare('SELECT short_desc, full_desc, icon_url, support_email FROM apps WHERE id = ?')
    .bind('app-test')
    .first();
  assert.deepEqual(row, {
    short_desc: '',
    full_desc: '',
    icon_url: '',
    support_email: '',
  });
  DB.close();
});

test('the console uses one GitHub-only APK path with a conservative 50 MB cap', async () => {
  const [storage, api, mediaRoute] = await Promise.all([
    readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8'),
    readFile(new URL('../worker/src/routes/media.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(storage, /MAX_APK_SIZE_BYTES = 50 \* 1024 \* 1024/);
  assert.match(storage, /return 'github'/);
  assert.match(api, /xhrJson\('POST', apiUrl\('\/uploads\/apk'\)/);
  assert.doesNotMatch(api, /apk-ticket|presigned-put|provider === 'b2'/);
  assert.match(mediaRoute, /export const MAX_APK_SIZE = 50 \* 1024 \* 1024/);
  assert.doesNotMatch(mediaRoute, /Backblaze|b2Presigned|apk-ticket/);
});
