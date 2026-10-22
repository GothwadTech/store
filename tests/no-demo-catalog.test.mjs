import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLocalD1 } from '../tools/local-d1.mjs';
import { moduleUrl } from './helpers/ts.mjs';

const workerUrl = await moduleUrl('worker/src/index.ts');
const { default: worker } = await import(workerUrl);
const bootstrapSql = await readFile(new URL('../sql/00_d1_console_bootstrap.sql', import.meta.url), 'utf8');

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

test('download endpoint does not expose an unapproved release', async () => {
  const DB = createLocalD1();
  await DB.exec(bootstrapSql);
  await DB.prepare(
    `INSERT INTO app_releases (
      id, app_id, version_code, version_name, apk_provider, apk_key, apk_url, apk_size_bytes,
      review_status, is_live, downloads, created_at
    ) VALUES ('rel-pending', 'app-gothwad-mail', 2, '1.0.1', 'github', 'mail.apk', 'https://files.test/pending.apk', 1024, 'pending', 0, 0, datetime('now'))`,
  ).run();

  const env = { DB, AUTH_HUB_URL: 'https://accounts.test' };
  const response = await worker.fetch(new Request('https://store.test/api/download/rel-pending'), env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
  DB.close();
});

test('download endpoint does not expose a live release for an unpublished app', async () => {
  const DB = createLocalD1();
  await DB.exec(bootstrapSql);
  await DB.prepare(
    `INSERT INTO apps (
      id, developer_id, package_name, name, category, kind, status, short_desc, full_desc, icon_url, support_email
    ) VALUES ('app-draft', 'dev-gothwad', 'com.gothwad.draft', 'Draft App', 'tools', 'app', 'draft', '', '', '', 'support@gothwadtech.com')`,
  ).run();
  await DB.prepare(
    `INSERT INTO app_releases (
      id, app_id, version_code, version_name, apk_provider, apk_key, apk_url, apk_size_bytes,
      review_status, is_live, downloads, created_at
    ) VALUES ('rel-draft-app', 'app-draft', 1, '1.0.0', 'github', 'draft.apk', 'https://files.test/draft.apk', 1024, 'approved', 1, 0, datetime('now'))`,
  ).run();

  const env = { DB, AUTH_HUB_URL: 'https://accounts.test' };
  const response = await worker.fetch(new Request('https://store.test/api/download/rel-draft-app'), env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
  DB.close();
});

test('demo fixtures and identity are synchronously gated off on production (brand zone) hosts', async () => {
  const seed = await readFile(new URL('../src/data/seed.ts', import.meta.url), 'utf8');
  const context = await readFile(new URL('../src/lib/AppContext.tsx', import.meta.url), 'utf8');
  const config = await readFile(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
  const brand = await readFile(new URL('../shared/brand.ts', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../src/lib/auth.ts', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../src/shared/ui.tsx', import.meta.url), 'utf8');
  const store = await readFile(new URL('../src/store/StoreApp.tsx', import.meta.url), 'utf8');
  const notice = await readFile(new URL('../src/shared/BackendNotice.tsx', import.meta.url), 'utf8');
  const consoleApp = await readFile(new URL('../src/console/ConsoleApp.tsx', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../src/admin/AdminApp.tsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

  assert.match(seed, /SEED_APPS/);
  assert.match(brand, /hostname\.toLowerCase\(\)\.replace/);
  assert.match(brand, /return host === domain \|\| host\.endsWith\(`\.\$\{domain\}`\);/);
  assert.match(brand, /appDomain: 'gothwadtech\.com'/);
  assert.match(config, /isBrandHost\(window\.location\.hostname, BRAND\.appDomain\)/);
  assert.match(config, /modeForHost\(host, BRAND\)/);
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
  assert.match(ui, /demoModeAvailable &&/);
  assert.match(store, /demoModeAvailable && <button/);
  assert.match(store, /const canPreviewDownload = demoModeAvailable && isDemoUser/);
  assert.match(notice, /if \(isPreviewMode\)/);
  assert.match(consoleApp, /demoModeAvailable && isDemoUser/);
  assert.match(admin, /demoModeAvailable && isDemoUser/);
  assert.match(app, /if \(isProductionHostCheck\(\)\) return null/);
});
