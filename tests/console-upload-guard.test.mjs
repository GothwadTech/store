import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { stripTypeScriptTypes } from 'node:module';

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  return `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
}

const apkUrl = await moduleUrl('../worker/src/apk.ts');
const workerUrl = await moduleUrl('../worker/src/index.ts');
const workerSource = Buffer.from(workerUrl.split(',')[1], 'base64').toString().replace("'./apk'", JSON.stringify(apkUrl));
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`);

const env = {
  AUTH_HUB_URL: 'https://accounts.test', SUPABASE_URL: 'https://database.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only', ADMIN_USERNAMES: '',
};

test('empty non-null listing fields stay empty strings instead of causing Postgres 23502', async (t) => {
  let app = {
    id: 'app-test', developer_id: 'dev-test', package_name: 'com.example.app', name: 'Example',
    status: 'draft', category: 'tools', kind: 'app', short_desc: 'Before', full_desc: 'Before',
    icon_url: 'https://image.test/icon.webp', support_email: 'dev@example.test', tags: [],
  };
  const developer = { id: 'dev-test', user_id: 'user-test', username: 'tester', org_name: 'Tester', display_name: 'Tester' };
  let write = null;
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input);
    if (url.href === `${env.AUTH_HUB_URL}/oauth/userinfo`) return Response.json({ sub: 'user-test', preferred_username: 'tester' });
    assert.equal(url.origin, env.SUPABASE_URL);
    const table = url.pathname.split('/').at(-1);
    if (table === 'developers') return Response.json([developer]);
    if (table === 'apps') {
      if (init.method === 'PATCH') {
        write = JSON.parse(init.body);
        app = { ...app, ...write };
        return Response.json([app]);
      }
      return Response.json([app]);
    }
    if (['app_screenshots', 'app_releases', 'reviews'].includes(table)) return Response.json([]);
    assert.fail(`Unexpected table ${table}`);
  });

  const response = await worker.fetch(new Request('https://console.test/api/dev/apps/app-test', {
    method: 'PATCH', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ shortDesc: '', fullDesc: '', iconUrl: '', supportEmail: '' }),
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(write, {
    updated_at: write.updated_at,
    short_desc: '',
    full_desc: '',
    icon_url: '',
    support_email: '',
  });
});

test('the console uses one GitHub-only APK path with a conservative 50 MB cap', async () => {
  const [storage, api, workerSourceText] = await Promise.all([
    readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8'),
    readFile(new URL('../worker/src/index.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(storage, /MAX_APK_SIZE_BYTES = 50 \* 1024 \* 1024/);
  assert.match(storage, /return 'github'/);
  assert.match(api, /xhrJson\('POST', apiUrl\('\/uploads\/apk'\)/);
  assert.doesNotMatch(api, /apk-ticket|presigned-put|provider === 'b2'/);
  assert.match(workerSourceText, /const MAX_APK_SIZE = 50 \* 1024 \* 1024/);
  assert.doesNotMatch(workerSourceText, /Backblaze|b2Presigned|apk-ticket/);
});
