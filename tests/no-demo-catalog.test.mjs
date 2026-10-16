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

test('unconfigured catalog returns empty API data instead of sample listings', async () => {
  const response = await worker.fetch(new Request('https://store.test/api/store/apps'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'unconfigured');
  assert.deepEqual(body.apps, []);
  assert.deepEqual(body.releases, []);
  assert.deepEqual(body.reviews, []);
  assert.doesNotMatch(JSON.stringify(body), /demo|sample|seed/i);
});

test('unconfigured category endpoint returns no local category fixtures', async () => {
  const response = await worker.fetch(new Request('https://store.test/api/store/categories'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'unconfigured');
  assert.deepEqual(body.categories, []);
});

test('download endpoint does not expose an unapproved release', async (t) => {
  const env = {
    AUTH_HUB_URL: 'https://accounts.test',
    SUPABASE_URL: 'https://database.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only',
  };
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    assert.equal(url.origin, env.SUPABASE_URL);
    assert.match(url.pathname, /\/app_releases$/);
    return Response.json([{ id: 'rel-pending', app_id: 'app-test', is_live: false, apk_url: 'https://files.test/pending.apk' }]);
  });
  const response = await worker.fetch(new Request('https://store.test/api/download/rel-pending'), env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
});

test('download endpoint does not expose a live release for an unpublished app', async (t) => {
  const env = {
    AUTH_HUB_URL: 'https://accounts.test',
    SUPABASE_URL: 'https://database.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only',
  };
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    assert.equal(url.origin, env.SUPABASE_URL);
    const table = url.pathname.split('/').at(-1);
    if (table === 'app_releases') {
      return Response.json([{ id: 'rel-draft-app', app_id: 'app-draft', is_live: true, apk_url: 'https://files.test/draft.apk' }]);
    }
    assert.equal(table, 'apps');
    assert.match(url.search, /status=eq\.published/);
    return Response.json([]);
  });
  const response = await worker.fetch(new Request('https://store.test/api/download/rel-draft-app'), env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
});

test('demo fixtures and identity are synchronously gated off on Gothwad production hosts', async () => {
  const seed = await readFile(new URL('../src/data/seed.ts', import.meta.url), 'utf8');
  const context = await readFile(new URL('../src/lib/AppContext.tsx', import.meta.url), 'utf8');
  const config = await readFile(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../src/lib/auth.ts', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../src/shared/ui.tsx', import.meta.url), 'utf8');
  const store = await readFile(new URL('../src/store/StoreApp.tsx', import.meta.url), 'utf8');
  const notice = await readFile(new URL('../src/shared/BackendNotice.tsx', import.meta.url), 'utf8');
  const consoleApp = await readFile(new URL('../src/console/ConsoleApp.tsx', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../src/admin/AdminApp.tsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.match(seed, /SEED_APPS/); // Fixtures remain available to local/preview.
  assert.match(config, /hostname\.toLowerCase\(\)\.replace/); // Trailing-dot DNS names are normalized.
  assert.match(config, /host === 'gothwadtech\.com' \|\| host\.endsWith\('\.gothwadtech\.com'\)/);
  assert.match(config, /export function isDemoModeAllowed\(\): boolean\s*\{\s*return !isProductionHostCheck\(\);/);
  assert.match(context, /const demoModeAvailable = isDemoModeAllowed\(\);/);
  assert.match(context, /useState<AppState>\(\(\) => loadState\(demoModeAvailable\)\)/);
  assert.match(context, /useState<GothwadUser \| null>\(\(\) => loadDemoUser\(demoModeAvailable\)\)/);
  assert.match(context, /if \(!demoModeAvailable\) return emptyState/);
  assert.match(context, /if \(!demoModeAvailable\) return null/);
  assert.match(context, /if \(!demoModeAvailable && next\?\.id === DEMO_USER\.id\) return/);
  assert.match(context, /const isPreviewMode = demoModeAvailable/);
  assert.match(context, /if \(apiMode\(\) \|\| isLocalDemo\(\)\) return;/);
  assert.match(auth, /export const DEMO_USER/);
  assert.match(ui, /demoModeAvailable &&/); // The prompt demo sign-in option is preview-only.
  assert.match(store, /demoModeAvailable && <button/); // Header demo sign-in is preview-only.
  assert.match(store, /const canPreviewDownload = demoModeAvailable && isDemoUser/);
  assert.match(notice, /if \(isPreviewMode\)/); // No preview notice on production hosts.
  assert.match(consoleApp, /demoModeAvailable && isDemoUser/);
  assert.match(admin, /demoModeAvailable && isDemoUser/);
  assert.match(app, /if \(isProductionHostCheck\(\)\) return null/); // Hide the mode switcher on prod.
});
