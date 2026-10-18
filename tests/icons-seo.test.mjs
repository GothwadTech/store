import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import test from 'node:test';
import { moduleUrl } from './helpers/ts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// manifest.json build me generate hota hai (shared/brand.ts + env) - static file nahi.
const { manifestFor, resolveBrand } = await import(await moduleUrl('shared/brand.ts'));
const defaultManifest = manifestFor(resolveBrand({}));

function hasVisibleRgbaPixel(data) {
  assert.deepEqual(data.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const compressed = [];

  for (let offset = 8; offset < data.length;) {
    const size = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + size);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === 'IDAT') {
      compressed.push(chunk);
    }
    offset += size + 12;
  }

  assert.equal(bitDepth, 8, 'expected an 8-bit PNG');
  assert.equal(colorType, 6, 'expected an RGBA PNG');
  assert.equal(interlace, 0, 'expected a non-interlaced PNG');
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  let previous = Buffer.alloc(stride);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset];
    offset += 1;
    const row = Buffer.from(raw.subarray(offset, offset + stride));
    offset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? row[x - 4] : 0;
      const up = previous[x];
      const upperLeft = x >= 4 ? previous[x - 4] : 0;
      if (filter === 1) row[x] = (row[x] + left) & 255;
      else if (filter === 2) row[x] = (row[x] + up) & 255;
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upperLeft;
        const leftDistance = Math.abs(p - left);
        const upDistance = Math.abs(p - up);
        const upperLeftDistance = Math.abs(p - upperLeft);
        const predictor = leftDistance <= upDistance && leftDistance <= upperLeftDistance
          ? left
          : upDistance <= upperLeftDistance ? up : upperLeft;
        row[x] = (row[x] + predictor) & 255;
      } else assert.equal(filter, 0, `unsupported PNG filter ${filter}`);
    }

    for (let x = 3; x < stride; x += 4) {
      if (row[x] > 0) return true;
    }
    previous = row;
  }
  return false;
}

test('PWA manifest references present, correctly sized, visible web icons', () => {
  const manifest = defaultManifest;
  assert.equal(manifest.name, 'Kiwi Store');
  assert.equal(manifest.short_name, 'Kiwi');
  assert.ok(manifest.icons.length >= 5);

  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('/assets/'), `${icon.src} should live in /assets`);
    const relativePath = join('public', icon.src.slice(1));
    assert.ok(existsSync(join(root, relativePath)), `${relativePath} is missing`);
    const data = readFileSync(join(root, relativePath));
    assert.ok(data.length > 1000, `${relativePath} looks empty`);

    if (icon.type === 'image/png') {
      assert.deepEqual(data.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      assert.equal(data.readUInt32BE(16), Number(icon.sizes.split('x')[0]), `${relativePath} width mismatch`);
      assert.equal(data.readUInt32BE(20), Number(icon.sizes.split('x')[1]), `${relativePath} height mismatch`);
      assert.ok(hasVisibleRgbaPixel(data), `${relativePath} must not be fully transparent`);
    } else {
      assert.deepEqual([...data.subarray(0, 4)], [0, 0, 1, 0], 'favicon must be a valid ICO file');
    }
  }
});

test('all app surfaces and SEO metadata use the shared brand icons', () => {
  const html = read('index.html');
  const manifest = JSON.stringify(defaultManifest);
  const app = read('src/App.tsx');
  const sharedUi = read('src/shared/ui.tsx');
  const seed = read('src/data/seed.ts');

  for (const path of [
    '/assets/favicon.ico',
    '/assets/apple-touch-icon.png',
    '/assets/icon-192.png',
    '/assets/icon-512.png',
  ]) assert.ok(html.includes(path), `index.html should reference ${path}`);
  for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card', 'twitter:image']) {
    assert.ok(html.includes(tag), `index.html should include ${tag}`);
  }
  assert.ok(html.includes('rel="canonical"'));
  assert.ok(!html.includes('/icon.svg'));
  assert.ok(!manifest.includes('/icon.svg'));
  assert.ok(sharedUi.includes('src="/assets/icon-192.png"'), 'shared Logo should use the new brand icon');
  assert.ok(seed.includes("iconUrl: '/assets/icon-512.png'"), 'demo Store listing should use the new brand icon');
  assert.ok(app.includes('seoFor(mode, BRAND)'), 'App.tsx should take SEO copy from the brand config');
  const viteConfig = read('vite.config.ts');
  assert.ok(viteConfig.includes("fileName: 'manifest.json'"), 'manifest.json should be generated at build time');
  assert.ok(viteConfig.includes('renderIndexHtml(html, brand)'), 'index.html tokens should be filled from the brand config');
  assert.ok(app.includes("'noindex,nofollow'"), 'Console/Admin and preview metadata should not be indexed');
});
