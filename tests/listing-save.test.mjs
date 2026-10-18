import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleUrl } from './helpers/ts.mjs';

// Run the real Worker handler with mocked Accounts/Supabase, without a deployment.
const apkUrl = await moduleUrl('worker/src/apk.ts');
const brandUrl = await moduleUrl('shared/brand.ts');
const workerUrl = await moduleUrl('worker/src/index.ts');
// Worker ke relative imports ko inline karo (apk + shared brand config).
const workerSource = Buffer.from(workerUrl.split(',')[1], 'base64')
  .toString()
  .replace("'./apk'", JSON.stringify(apkUrl))
  .replace("'../../shared/brand'", JSON.stringify(brandUrl));
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);

const env = {
  AUTH_HUB_URL: 'https://accounts.test', SUPABASE_URL: 'https://database.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only', ADMIN_USERNAMES: '',
};

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
    let app = { id: 'app-test', developer_id: 'dev-test', name: 'Before', status: scenario.current };
    const developer = { id: 'dev-test', user_id: 'user-test' };
    const writes = [];
    t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
      const url = new URL(input);
      if (url.href === `${env.AUTH_HUB_URL}/oauth/userinfo`) {
        return Response.json({ sub: 'user-test', preferred_username: 'tester' });
      }
      assert.equal(url.origin, env.SUPABASE_URL);
      const table = url.pathname.split('/').at(-1);
      if (init.method === 'PATCH') {
        assert.equal(table, 'apps');
        const patch = JSON.parse(init.body);
        writes.push(patch);
        app = { ...app, ...patch };
        return Response.json([app]);
      }
      if (table === 'apps') return Response.json([app]);
      if (table === 'developers') return Response.json([developer]);
      assert.ok(['app_screenshots', 'app_releases', 'reviews'].includes(table), `Unexpected table: ${table}`);
      return Response.json([]); // No live/approved release exists.
    });
    const response = await worker.fetch(new Request('https://console.test/api/dev/apps/app-test', {
      method: 'PATCH', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'After', shortDesc: 'Updated listing', ...scenario.body }),
    }), env);
    const result = await response.json();
    assert.equal(response.status, scenario.expected, JSON.stringify(result));
    if (scenario.expected === 200) {
      assert.equal(result.app.name, 'After');
      assert.equal(result.app.shortDesc, 'Updated listing');
      assert.equal(result.app.status, scenario.current);
      assert.equal(writes.length, 1);
      assert.equal(Object.hasOwn(writes[0], 'status'), false);
    } else {
      assert.equal(result.error, scenario.error);
      assert.equal(writes.length, 0);
    }
  });
}
