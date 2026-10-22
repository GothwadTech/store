import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLocalD1 } from '../tools/local-d1.mjs';
import { moduleUrl } from './helpers/ts.mjs';

const workerUrl = await moduleUrl('worker/src/index.ts');
const { default: worker } = await import(workerUrl);

const bootstrapSql = await readFile(new URL('../sql/00_d1_console_bootstrap.sql', import.meta.url), 'utf8');

async function freshEnv() {
  const DB = createLocalD1();
  await DB.exec(bootstrapSql);
  return {
    DB,
    AUTH_HUB_URL: 'https://api.gothwadtech.com',
    ADMIN_USERNAMES: 'pawangothwad',
  };
}

test('F-Droid Catalog endpoint returns curated open-source apps & games, filters by kind/category/query, and merges live search hits', async (t) => {
  const env = await freshEnv();

  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    if (url.hostname === 'search.f-droid.org') {
      return Response.json({
        apps: [
          {
            name: 'Syncthing-Fork',
            summary: 'Open-source continuous file synchronization wrapper for Android',
            icon: 'https://f-droid.org/repo/com.github.catfriend1.syncthingandroid/en-US/icon.png',
            url: 'https://f-droid.org/packages/com.github.catfriend1.syncthingandroid',
          },
        ],
      });
    }
    return new Response('Not Found', { status: 404 });
  });

  // 1. Default F-Droid catalog
  const allRes = await worker.fetch(new Request('https://kiwistore.gothwadtech.com/api/store/fdroid'), env);
  assert.equal(allRes.status, 200);
  const allData = await allRes.json();
  assert.equal(allData.source, 'F-Droid');
  assert.ok(allData.apps.length >= 15);
  assert.ok(allData.apps.every((a) => a.id.startsWith('fdroid:') && a.source === 'F-Droid' && a.status === 'published'));
  assert.ok(allData.releases.every((r) => r.apkProvider === 'fdroid' && r.isLive === true && r.reviewStatus === 'approved'));

  // 2. Games filter
  const gamesRes = await worker.fetch(new Request('https://kiwistore.gothwadtech.com/api/store/fdroid?kind=game'), env);
  const gamesData = await gamesRes.json();
  assert.ok(gamesData.apps.length >= 3);
  assert.ok(gamesData.apps.every((a) => a.kind === 'game'));

  // 3. Search with live F-Droid search enrichment
  const searchRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/store/fdroid?q=syncthing'),
    env,
  );
  const searchData = await searchRes.json();
  assert.ok(searchData.apps.some((a) => a.packageName === 'com.github.catfriend1.syncthingandroid'));
  env.DB.close();
});

test('/api/store/apps keeps pure D1 by default and merges F-Droid when ?fdroid=1 is passed', async () => {
  const env = await freshEnv();

  const pureRes = await worker.fetch(new Request('https://kiwistore.gothwadtech.com/api/store/apps'), env);
  const pureData = await pureRes.json();
  assert.equal(pureData.apps.length, 5);
  assert.ok(pureData.apps.every((a) => !a.id.startsWith('fdroid:')));

  const mergedRes = await worker.fetch(new Request('https://kiwistore.gothwadtech.com/api/store/apps?fdroid=1'), env);
  const mergedData = await mergedRes.json();
  assert.ok(mergedData.apps.length > 15);
  // First 5 listings are the official D1 apps
  assert.equal(mergedData.apps[0].packageName, 'com.gothwad.store');
  assert.ok(mergedData.apps.some((a) => a.id === 'fdroid:org.videolan.vlc'));
  env.DB.close();
});

test('F-Droid App Detail, Live Version Enrichment, Download 302 Redirect, Icon Fallback, and Wishlist', async (t) => {
  const env = await freshEnv();

  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    if (url.pathname === '/api/v1/packages/org.videolan.vlc') {
      return Response.json({
        packageName: 'org.videolan.vlc',
        suggestedVersionCode: 13060500,
        packages: [
          { versionName: '3.6.5', versionCode: 13060500 },
          { versionName: '3.6.3', versionCode: 13060308 },
        ],
      });
    }
    if (url.pathname === '/api/oauth/userinfo') {
      return Response.json({
        sub: 'usr-pawan',
        preferred_username: 'pawangothwad',
        email: 'pawan@gothwadtech.com',
        name: 'Pawan Gothwad',
      });
    }
    return new Response('Not Found', { status: 404 });
  });

  // 1. Detail route enriches from F-Droid Package API v1
  const detailRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/store/apps/fdroid:org.videolan.vlc'),
    env,
  );
  assert.equal(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.equal(detail.app.id, 'fdroid:org.videolan.vlc');
  assert.equal(detail.app.source, 'F-Droid');
  assert.equal(detail.liveRelease.versionCode, 13060500);
  assert.equal(detail.liveRelease.versionName, '3.6.5');
  assert.equal(detail.liveRelease.apkUrl, 'https://f-droid.org/repo/org.videolan.vlc_13060500.apk');
  assert.equal(detail.releases.length, 2);

  // 2. Download route redirects 302 to live F-Droid APK URL
  const dlRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/download/fdroid:org.videolan.vlc'),
    env,
  );
  assert.equal(dlRes.status, 302);
  assert.equal(dlRes.headers.get('Location'), 'https://f-droid.org/repo/org.videolan.vlc_13060500.apk');

  // 3. Icon route falls back to crisp SVG icon when upstream search has no hit
  const iconRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/store/fdroid/icon/org.videolan.vlc'),
    env,
  );
  assert.equal(iconRes.status, 200);
  assert.match(iconRes.headers.get('Content-Type') ?? '', /image\/svg\+xml/);

  // 4. Signed-in user can wishlist an F-Droid app
  const wishRes = await worker.fetch(
    new Request('https://kiwistore.gothwadtech.com/api/store/apps/fdroid%3Aorg.videolan.vlc/wishlist', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok-pawan' },
    }),
    env,
  );
  assert.equal(wishRes.status, 200);
  const wishList = await (
    await worker.fetch(
      new Request('https://kiwistore.gothwadtech.com/api/store/wishlist', {
        headers: { Authorization: 'Bearer tok-pawan' },
      }),
      env,
    )
  ).json();
  assert.deepEqual(wishList.appIds, ['fdroid:org.videolan.vlc']);
  env.DB.close();
});
