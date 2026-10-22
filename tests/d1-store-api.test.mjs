import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLocalD1 } from '../tools/local-d1.mjs';
import { moduleUrl } from './helpers/ts.mjs';

const workerUrl = await moduleUrl('worker/src/index.ts');
const { default: worker } = await import(workerUrl);

const bootstrapSql = await readFile(new URL('../sql/00_d1_console_bootstrap.sql', import.meta.url), 'utf8');
const schemaSql = await readFile(new URL('../sql/01_store_schema.sql', import.meta.url), 'utf8');

async function freshEnv(extra = {}) {
  const DB = createLocalD1();
  await DB.exec(bootstrapSql);
  return {
    DB,
    AUTH_HUB_URL: 'https://api.gothwadtech.com',
    ADMIN_USERNAMES: 'pawangothwad',
    GITHUB_TOKEN: 'gh-test-token',
    GITHUB_FILES_REPO: 'GothwadTech/storefiles',
    ...extra,
  };
}

test('D1 SQL bootstrap and schema are idempotent, create 13 tables, seed 12 categories and 5 official apps', async () => {
  const DB = createLocalD1();
  await DB.exec(bootstrapSql);
  await DB.exec(bootstrapSql);
  await DB.exec(schemaSql);
  await DB.exec(schemaSql);

  const { results: tables } = await DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  ).all();
  const names = tables.map((r) => r.name);
  assert.deepEqual(names, [
    'app_releases',
    'app_screenshots',
    'apps',
    'categories',
    'developers',
    'downloads',
    'library',
    'reports',
    'review_submissions',
    'reviews',
    'store_audit_log',
    'store_images',
    'wishlists',
  ]);

  const { results: cats } = await DB.prepare('SELECT slug, name, kind, icon FROM categories').all();
  assert.equal(cats.length, 12);

  const { results: apps } = await DB.prepare('SELECT id, package_name, status, featured FROM apps ORDER BY id').all();
  assert.equal(apps.length, 5);
  assert.ok(apps.every((a) => a.status === 'published'));

  const { results: rels } = await DB.prepare('SELECT app_id, review_status, is_live FROM app_releases').all();
  assert.equal(rels.length, 5);
  assert.ok(rels.every((r) => r.review_status === 'approved' && r.is_live === 1));
  DB.close();
});

test('Public Store Catalog endpoints satisfy web and Android storeapp contracts', async () => {
  const env = await freshEnv();

  const healthRes = await worker.fetch(new Request('https://store.gothwadtech.com/api/health'), env);
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.ok, true);
  assert.equal(health.engine, 'cloudflare-d1');
  assert.equal(health.configured.d1, true);

  const catsRes = await worker.fetch(new Request('https://store.gothwadtech.com/api/store/categories'), env);
  assert.equal(catsRes.status, 200);
  const cats = await catsRes.json();
  assert.equal(cats.source, 'live');
  assert.equal(cats.categories.length, 12);

  for (const endpoint of ['/api/store/apps', '/api/store/home', '/api/store/charts', '/api/store/search?q=mail']) {
    const res = await worker.fetch(new Request(`https://store.gothwadtech.com${endpoint}`), env);
    assert.equal(res.status, 200, endpoint);
    const data = await res.json();
    assert.equal(data.source, 'live');
    assert.ok(Array.isArray(data.apps) && data.apps.length >= 1);
    assert.ok(Array.isArray(data.releases));
    assert.ok(Array.isArray(data.reviews));
  }

  const byPkgRes = await worker.fetch(
    new Request('https://store.gothwadtech.com/api/store/apps/com.gothwad.store'),
    env,
  );
  assert.equal(byPkgRes.status, 200);
  const byPkg = await byPkgRes.json();
  assert.equal(byPkg.app.id, 'app-kiwi-store');
  assert.equal(byPkg.app.packageName, 'com.gothwad.store');
  assert.equal(byPkg.app.featured, 'hero');
  assert.equal(byPkg.liveRelease.isLive, true);
  assert.equal(byPkg.liveRelease.reviewStatus, 'approved');
  assert.equal(byPkg.liveRelease.apkUrl, '/api/download/rel-kiwi-store-1');
  assert.ok(byPkg.screenshots.length >= 2);
  env.DB.close();
});

test('Auth & Multi-Account SSO: Cookie + X-Gothwad-Authuser, Set-Cookie rotation passthrough, Bearer fallback, and 5xx resilience', async (t) => {
  const env = await freshEnv();
  let capturedAuthuser = null;

  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    if (url.pathname === '/api/auth/me') {
      capturedAuthuser = headers.get('X-Gothwad-Authuser') ?? url.searchParams.get('authuser');
      if (headers.get('Cookie')?.includes('gothwad_outage=1')) {
        return new Response('Upstream error', { status: 502 });
      }
      if (!headers.get('Cookie')?.includes('gothwad_session')) {
        return Response.json({ authenticated: false }, { status: 401 });
      }
      const resHeaders = new Headers({ 'Content-Type': 'application/json' });
      resHeaders.append('Set-Cookie', 'gothwad_slot_a=rotated1; Domain=.gothwadtech.com; Path=/; HttpOnly; Secure');
      resHeaders.append('Set-Cookie', 'gothwad_active=b; Domain=.gothwadtech.com; Path=/; Secure');
      return new Response(
        JSON.stringify({
          authenticated: true,
          activeId: 'b',
          authuser: 1,
          user: {
            id: 'usr-pawan',
            username: 'pawangothwad',
            email: 'pawan@gothwadtech.com',
            name: 'Pawan Gothwad',
          },
          accounts: [
            { id: 'a', authuser: 0, username: 'dev1', email: 'dev1@gothwadtech.com', name: 'Dev One', active: false },
            { id: 'b', authuser: 1, username: 'pawangothwad', email: 'pawan@gothwadtech.com', name: 'Pawan Gothwad', active: true },
          ],
        }),
        { status: 200, headers: resHeaders },
      );
    }
    if (url.pathname === '/api/oauth/userinfo') {
      if (headers.get('Authorization') === 'Bearer android-token') {
        return Response.json({
          sub: 'usr-android',
          preferred_username: 'androiduser',
          email: 'android@gothwadtech.com',
          name: 'Android User',
        });
      }
      return new Response('Unauthorized', { status: 401 });
    }
    if (url.pathname === '/api/auth/switch') {
      return new Response(JSON.stringify({ ok: true, activeId: 'a', authuser: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'gothwad_active=a; Path=/' },
      });
    }
    if (url.pathname === '/api/auth/accounts/a/signout') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'gothwad_slot_a=; Max-Age=0; Path=/' },
      });
    }
    assert.fail(`Unexpected fetch: ${url.href}`);
  });

  const meRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/me', {
      headers: {
        Origin: 'https://kiwistore.gothwadtech.com',
        Cookie: 'gothwad_session=valid',
        'X-Gothwad-Authuser': '1',
      },
    }),
    env,
  );
  assert.equal(meRes.status, 200);
  assert.equal(capturedAuthuser, '1');
  assert.equal(meRes.headers.get('Access-Control-Allow-Credentials'), 'true');
  const setCookies = meRes.headers.getSetCookie();
  assert.equal(setCookies.length, 2);
  const meBody = await meRes.json();
  assert.equal(meBody.authenticated, true);
  assert.equal(meBody.isAdmin, true);
  assert.equal(meBody.activeSlot, 'b');
  assert.equal(meBody.authuser, 1);
  assert.equal(meBody.accounts.length, 2);

  const outageRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/auth/accounts', {
      headers: { Cookie: 'gothwad_outage=1' },
    }),
    env,
  );
  assert.equal(outageRes.status, 503);

  const bearerRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/me', {
      headers: { Authorization: 'Bearer android-token' },
    }),
    env,
  );
  assert.equal(bearerRes.status, 200);
  const bearerBody = await bearerRes.json();
  assert.equal(bearerBody.user.username, 'androiduser');
  assert.equal(bearerBody.isAdmin, false);

  const switchRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/auth/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'gothwad_session=valid' },
      body: JSON.stringify({ authuser: 0 }),
    }),
    env,
  );
  assert.equal(switchRes.status, 200);
  assert.ok(switchRes.headers.getSetCookie().some((c) => c.includes('gothwad_active=a')));

  const slotOutRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/auth/accounts/a/signout', {
      method: 'POST',
      headers: { Cookie: 'gothwad_session=valid' },
    }),
    env,
  );
  assert.equal(slotOutRes.status, 200);
  assert.ok(slotOutRes.headers.getSetCookie().some((c) => c.includes('Max-Age=0')));
  env.DB.close();
});

test('Store User Actions: wishlist, library, reviews with live rating recalculation, and abuse reports', async (t) => {
  const env = await freshEnv();
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      sub: 'usr-1',
      preferred_username: 'rahul',
      email: 'rahul@gothwadtech.com',
      name: 'Rahul',
    }),
  );
  const authHeaders = { Authorization: 'Bearer tok-rahul', 'Content-Type': 'application/json' };

  const wishAdd = await worker.fetch(
    new Request('https://store.gothwadtech.com/api/store/apps/app-kiwi-store/wishlist', {
      method: 'POST',
      headers: authHeaders,
    }),
    env,
  );
  assert.equal(wishAdd.status, 200);
  const wishList = await (
    await worker.fetch(new Request('https://store.gothwadtech.com/api/store/wishlist', { headers: authHeaders }), env)
  ).json();
  assert.deepEqual(wishList.appIds, ['app-kiwi-store']);

  await worker.fetch(
    new Request('https://store.gothwadtech.com/api/store/apps/app-kiwi-store/wishlist', {
      method: 'DELETE',
      headers: authHeaders,
    }),
    env,
  );
  const wishAfter = await (
    await worker.fetch(new Request('https://store.gothwadtech.com/api/store/wishlist', { headers: authHeaders }), env)
  ).json();
  assert.deepEqual(wishAfter.appIds, []);

  const libAdd = await worker.fetch(
    new Request('https://store.gothwadtech.com/api/store/apps/com.gothwad.mail/library', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ versionCode: 102 }),
    }),
    env,
  );
  assert.equal(libAdd.status, 200);
  const libList = await (
    await worker.fetch(new Request('https://store.gothwadtech.com/api/store/library', { headers: authHeaders }), env)
  ).json();
  assert.deepEqual(libList.appIds, ['app-gothwad-mail']);

  const revAdd = await worker.fetch(
    new Request('https://store.gothwadtech.com/api/store/apps/app-kiwi-store/reviews', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ rating: 5, title: 'Superb', body: 'Fast and clean D1 store!' }),
    }),
    env,
  );
  assert.equal(revAdd.status, 200);
  const appAfterRev = await env.DB.prepare('SELECT rating_avg, rating_count FROM apps WHERE id = ?')
    .bind('app-kiwi-store')
    .first();
  assert.equal(appAfterRev.rating_count, 1);
  assert.equal(appAfterRev.rating_avg, 5);

  const revDel = await worker.fetch(
    new Request('https://store.gothwadtech.com/api/store/apps/app-kiwi-store/reviews', {
      method: 'DELETE',
      headers: authHeaders,
    }),
    env,
  );
  assert.equal(revDel.status, 200);
  const appAfterDel = await env.DB.prepare('SELECT rating_avg, rating_count FROM apps WHERE id = ?')
    .bind('app-kiwi-store')
    .first();
  assert.equal(appAfterDel.rating_count, 0);

  const repRes = await worker.fetch(
    new Request('https://store.gothwadtech.com/api/store/apps/app-kiwi-store/report', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reason: 'Other', details: 'Test report' }),
    }),
    env,
  );
  assert.equal(repRes.status, 201);
  env.DB.close();
});
