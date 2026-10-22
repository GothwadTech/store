import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLocalD1 } from '../tools/local-d1.mjs';
import { moduleUrl } from './helpers/ts.mjs';

const workerUrl = await moduleUrl('worker/src/index.ts');
const { default: worker } = await import(workerUrl);
const bootstrapSql = await readFile(new URL('../sql/00_d1_console_bootstrap.sql', import.meta.url), 'utf8');

for (const scenario of [
  { label: 'Draft listing without status', current: 'draft', body: {}, expected: 200 },
  { label: 'Draft listing with unchanged status', current: 'draft', body: { status: 'draft' }, expected: 200 },
  { label: 'In-review listing with unchanged status', current: 'in_review', body: { status: 'in_review' }, expected: 200 },
  { label: 'Published listing with unchanged status', current: 'published', body: { status: 'published' }, expected: 200 },
  { label: 'Draft cannot publish without a live release', current: 'draft', body: { status: 'published' }, expected: 400, error: 'no_live_release' },
  { label: 'Developer cannot restore a suspended app', current: 'suspended', body: { status: 'published' }, expected: 403, error: 'app_suspended' },
  { label: 'Actual transition to draft is still forbidden', current: 'in_review', body: { status: 'draft' }, expected: 400, error: 'bad_request' },
]) {
  test(scenario.label, async (t) => {
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
        'app-test', 'dev-test', 'com.example.app', 'Before', ?, 'tools', 'app',
        '', '', '', 'dev@example.test'
      )`,
    ).bind(scenario.current).run();

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
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'After', shortDesc: 'Updated listing', ...scenario.body }),
      }),
      env,
    );
    const result = await response.json();
    assert.equal(response.status, scenario.expected, JSON.stringify(result));
    if (scenario.expected === 200) {
      assert.equal(result.app.name, 'After');
      assert.equal(result.app.shortDesc, 'Updated listing');
      assert.equal(result.app.status, scenario.current);
      const saved = await DB.prepare('SELECT name, short_desc, status FROM apps WHERE id = ?').bind('app-test').first();
      assert.equal(saved.name, 'After');
      assert.equal(saved.short_desc, 'Updated listing');
      assert.equal(saved.status, scenario.current);
    } else {
      assert.equal(result.error, scenario.error);
      const saved = await DB.prepare('SELECT name, status FROM apps WHERE id = ?').bind('app-test').first();
      assert.equal(saved.name, 'Before');
      assert.equal(saved.status, scenario.current);
    }
    DB.close();
  });
}
