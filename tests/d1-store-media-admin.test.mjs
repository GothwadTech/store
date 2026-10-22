import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLocalD1 } from '../tools/local-d1.mjs';
import { moduleUrl } from './helpers/ts.mjs';

const workerUrl = await moduleUrl('worker/src/index.ts');
const { default: worker } = await import(workerUrl);

const bootstrapSql = await readFile(new URL('../sql/00_d1_console_bootstrap.sql', import.meta.url), 'utf8');

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

test('D1 Image Storage + Cloudflare Edge Cache CDN: upload, SHA-256 dedupe, magic-byte validation, 400 KB limit, ETag 304, and Edge Cache hit', async (t) => {
  const env = await freshEnv();
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      sub: 'usr-dev',
      preferred_username: 'indiedev',
      email: 'indie@gothwadtech.com',
      name: 'Indie Dev',
    }),
  );

  // Minimal valid WebP header (RIFF....WEBP)
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
    0x08, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  ]);
  const form = new FormData();
  form.append('image', new Blob([webpBytes], { type: 'image/webp' }), 'icon.webp');
  form.append('kind', 'icon');

  const up1 = await worker.fetch(
    new Request('https://kiwiconsole.gothwadtech.com/api/uploads/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-token' },
      body: form,
    }),
    env,
  );
  assert.equal(up1.status, 200);
  const up1Body = await up1.json();
  assert.equal(up1Body.provider, 'd1');
  assert.match(up1Body.url, /^https:\/\/kiwistore\.gothwadtech\.com\/api\/images\/img-[^?]+\?v=[0-9a-f]{12}$/);

  // Duplicate upload returns exact same image id without duplicating row
  const form2 = new FormData();
  form2.append('image', new Blob([webpBytes], { type: 'image/webp' }), 'icon2.webp');
  const up2 = await (
    await worker.fetch(
      new Request('https://kiwiconsole.gothwadtech.com/api/uploads/image', {
        method: 'POST',
        headers: { Authorization: 'Bearer dev-token' },
        body: form2,
      }),
      env,
    )
  ).json();
  assert.equal(up2.id, up1Body.id);
  const countRow = await env.DB.prepare('SELECT COUNT(*) AS c FROM store_images').first();
  assert.equal(countRow.c, 1);

  // Invalid magic bytes rejected with 415
  const badForm = new FormData();
  badForm.append('image', new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/webp' }), 'bad.webp');
  const badRes = await worker.fetch(
    new Request('https://kiwiconsole.gothwadtech.com/api/uploads/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-token' },
      body: badForm,
    }),
    env,
  );
  assert.equal(badRes.status, 415);

  // > 400 KB rejected with 413
  const huge = new Uint8Array(401_000);
  huge.set(webpBytes, 0);
  const hugeForm = new FormData();
  hugeForm.append('image', new Blob([huge], { type: 'image/webp' }), 'huge.webp');
  const hugeRes = await worker.fetch(
    new Request('https://kiwiconsole.gothwadtech.com/api/uploads/image', {
      method: 'POST',
      headers: { Authorization: 'Bearer dev-token' },
      body: hugeForm,
    }),
    env,
  );
  assert.equal(hugeRes.status, 413);

  // Mock Cloudflare caches.default and verify GET /api/images/:id populates cache and serves 304
  const cacheStore = new Map();
  globalThis.caches = {
    default: {
      async match(req) {
        const hit = cacheStore.get(req.url);
        return hit ? hit.clone() : undefined;
      },
      async put(req, res) {
        cacheStore.set(req.url, res.clone());
      },
    },
  };

  try {
    const get1 = await worker.fetch(new Request(up1Body.url), env);
    assert.equal(get1.status, 200);
    assert.equal(get1.headers.get('Content-Type'), 'image/webp');
    assert.equal(get1.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
    assert.equal(get1.headers.get('ETag'), `"${up1Body.sha256}"`);
    const bytesOut = new Uint8Array(await get1.arrayBuffer());
    assert.deepEqual(bytesOut, webpBytes);
    assert.equal(cacheStore.size, 1);

    // If-None-Match returns 304 Not Modified
    const get304 = await worker.fetch(
      new Request(up1Body.url, { headers: { 'If-None-Match': `"${up1Body.sha256}"` } }),
      env,
    );
    assert.equal(get304.status, 304);

    // Delete from D1 to prove subsequent GET is served from caches.default!
    await env.DB.prepare('DELETE FROM store_images WHERE id = ?').bind(up1Body.id).run();
    const getCached = await worker.fetch(new Request(up1Body.url), env);
    assert.equal(getCached.status, 200);
    assert.deepEqual(new Uint8Array(await getCached.arrayBuffer()), webpBytes);
  } finally {
    delete globalThis.caches;
    env.DB.close();
  }
});

test('End-to-End Developer Console -> Release Submit -> Admin Approve / Suspend / Restore / Feature + Audit Log', async (t) => {
  const env = await freshEnv();
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/userinfo')) {
      return Response.json({
        sub: 'usr-admin',
        preferred_username: 'pawangothwad',
        email: 'pawan@gothwadtech.com',
        name: 'Pawan Gothwad',
      });
    }
    assert.fail(`Unexpected fetch: ${url.href}`);
  });
  const headers = { Authorization: 'Bearer admin-tok', 'Content-Type': 'application/json' };

  const regRes = await worker.fetch(
    new Request('https://kiwiconsole.gothwadtech.com/api/dev/register', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        displayName: 'Pawan Gothwad',
        orgName: 'Gothwad Studios',
        supportEmail: 'support@gothwadtech.com',
        website: 'https://gothwadtech.com',
      }),
    }),
    env,
  );
  assert.equal(regRes.status, 200);

  const createRes = await worker.fetch(
    new Request('https://kiwiconsole.gothwadtech.com/api/dev/apps', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Gothwad Notes',
        packageName: 'com.gothwad.notes',
        category: 'productivity',
        kind: 'app',
      }),
    }),
    env,
  );
  assert.equal(createRes.status, 201);
  const { app: createdApp } = await createRes.json();

  const patchRes = await worker.fetch(
    new Request(`https://kiwiconsole.gothwadtech.com/api/dev/apps/${createdApp.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        shortDesc: 'Encrypted notes for Gothwad Account',
        fullDesc: 'Fast markdown notes synced with your Gothwad Account.',
        iconUrl: 'https://kiwistore.gothwadtech.com/api/images/img-notes-icon',
        supportEmail: 'support@gothwadtech.com',
        screenshots: [
          'https://kiwistore.gothwadtech.com/api/images/img-shot-1',
          'https://kiwistore.gothwadtech.com/api/images/img-shot-2',
        ],
      }),
    }),
    env,
  );
  assert.equal(patchRes.status, 200);

  const relRes = await worker.fetch(
    new Request(`https://kiwiconsole.gothwadtech.com/api/dev/apps/${createdApp.id}/releases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        versionName: '1.0.0',
        versionCode: 1,
        changelog: 'Initial release',
        permissions: ['android.permission.INTERNET'],
        apk: {
          provider: 'github',
          url: 'https://github.com/GothwadTech/storefiles/releases/download/com.gothwad.notes%401/notes.apk',
          key: 'com.gothwad.notes@1/notes.apk',
          sizeBytes: 4_194_304,
          sha256: 'abc123',
        },
      }),
    }),
    env,
  );
  assert.equal(relRes.status, 201);
  const { release } = await relRes.json();

  const subRes = await worker.fetch(
    new Request(
      `https://kiwiconsole.gothwadtech.com/api/dev/apps/${createdApp.id}/releases/${release.id}/submit`,
      { method: 'POST', headers },
    ),
    env,
  );
  assert.equal(subRes.status, 200);
  const { submission } = await subRes.json();
  assert.equal(submission.status, 'pending');

  const approveRes = await worker.fetch(
    new Request(`https://kiwiadmin.gothwadtech.com/api/admin/submissions/${submission.id}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ note: 'Verified signature and permissions.' }),
    }),
    env,
  );
  assert.equal(approveRes.status, 200);

  const dlRes = await worker.fetch(
    new Request(`https://kiwistore.gothwadtech.com/api/download/${release.id}`, {
      headers: { 'CF-Connecting-IP': '203.0.113.9' },
    }),
    env,
  );
  assert.equal(dlRes.status, 302);
  assert.match(dlRes.headers.get('Location'), /storefiles\/releases\/download/);

  const featRes = await worker.fetch(
    new Request(`https://kiwiadmin.gothwadtech.com/api/admin/apps/${createdApp.id}/feature`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ featured: 'editors' }),
    }),
    env,
  );
  assert.equal(featRes.status, 200);
  assert.equal((await featRes.json()).app.featured, 'editors');

  const suspRes = await worker.fetch(
    new Request(`https://kiwiadmin.gothwadtech.com/api/admin/apps/${createdApp.id}/suspend`, {
      method: 'POST',
      headers,
    }),
    env,
  );
  assert.equal((await suspRes.json()).app.status, 'suspended');

  const restRes = await worker.fetch(
    new Request(`https://kiwiadmin.gothwadtech.com/api/admin/apps/${createdApp.id}/restore`, {
      method: 'POST',
      headers,
    }),
    env,
  );
  assert.equal((await restRes.json()).app.status, 'published');

  const { results: audits } = await env.DB.prepare('SELECT action FROM store_audit_log ORDER BY rowid').all();
  assert.deepEqual(
    audits.map((a) => a.action),
    ['submission.approve', 'app.feature', 'app.suspend', 'app.restore'],
  );
  env.DB.close();
});
