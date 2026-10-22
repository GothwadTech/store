import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { moduleUrl } from './helpers/ts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const {
  DEFAULT_SITE_HOSTS,
  htmlTokens,
  manifestFor,
  modeForHost,
  renderIndexHtml,
  resolveBrand,
  seoFor,
} = await import(await moduleUrl('shared/brand.ts'));

const SITE_MODES = ['store', 'console', 'admin', 'storeapp'];

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((entry) => {
    const full = join(root, dir, entry);
    return statSync(full).isDirectory() ? walk(join(dir, entry)) : [full];
  });
}

test('default brand is Kiwi Store on the kiwi* hostnames', () => {
  const brand = resolveBrand({});
  assert.equal(brand.appName, 'Kiwi Store');
  assert.equal(brand.shortName, 'Kiwi');
  assert.equal(brand.oauthClientId, 'kiwi-store');
  assert.equal(brand.accountsApiUrl, 'https://api.gothwadtech.com');
  assert.equal(brand.accountsSignInUrl, 'https://accounts.gothwadtech.com');
  assert.deepEqual(brand.siteUrls, {
    store: 'https://kiwistore.gothwadtech.com',
    console: 'https://kiwiconsole.gothwadtech.com',
    admin: 'https://kiwiadmin.gothwadtech.com',
    storeapp: 'https://kiwiapp.gothwadtech.com',
  });
  assert.deepEqual(DEFAULT_SITE_HOSTS, {
    store: 'kiwistore',
    console: 'kiwiconsole',
    admin: 'kiwiadmin',
    storeapp: 'kiwiapp',
  });
});

test('old Gothwad Store hostnames are gone from the defaults', () => {
  const brand = resolveBrand({});
  for (const url of Object.values(brand.siteUrls)) {
    assert.doesNotMatch(url, /(^|\/\/)(store|console|storeadmin|storeapp)\.gothwadtech\.com/);
  }
});

test('worker env (no VITE_ prefix) resolves the same four sites', () => {
  const brand = resolveBrand(
    {
      APP_NAME: 'Kiwi Store',
      APP_DOMAIN: 'gothwadtech.com',
      STORE_HOST: 'kiwistore',
      CONSOLE_HOST: 'kiwiconsole',
      ADMIN_HOST: 'kiwiadmin',
      STOREAPP_HOST: 'kiwiapp',
      AUTH_SIGNIN_URL: 'https://accounts.gothwadtech.com',
      AUTH_HUB_URL: 'https://api.gothwadtech.com',
      OAUTH_CLIENT_ID: 'kiwi-store',
    },
    { prefix: '' },
  );
  assert.equal(brand.siteUrls.console, 'https://kiwiconsole.gothwadtech.com');
  assert.equal(brand.accountsHost, 'accounts.gothwadtech.com');
  assert.equal(brand.accountsApiUrl, 'https://api.gothwadtech.com');
  assert.equal(brand.oauthClientId, 'kiwi-store');
});

test('future domain change is a single variable, not a code change', () => {
  const brand = resolveBrand({ VITE_APP_DOMAIN: 'kiwi.example', VITE_APP_NAME: 'Demo Store' });
  assert.equal(brand.appName, 'Demo Store');
  for (const mode of SITE_MODES) {
    assert.equal(brand.siteUrls[mode], `https://${DEFAULT_SITE_HOSTS[mode]}.kiwi.example`);
  }
  assert.equal(htmlTokens(brand).STORE_URL, 'https://kiwistore.kiwi.example');
  assert.equal(modeForHost('kiwiadmin.kiwi.example', brand), 'admin');
});

test('a full URL override wins over host + domain', () => {
  const brand = resolveBrand({
    VITE_APP_DOMAIN: 'kiwi.example',
    VITE_CONSOLE_URL: 'https://console.other-zone.dev/',
  });
  assert.equal(brand.siteUrls.console, 'https://console.other-zone.dev');
  assert.equal(brand.siteHosts.console, 'console.other-zone.dev');
  assert.equal(brand.siteUrls.store, 'https://kiwistore.kiwi.example');
});

test('hostname detection follows the configured hosts (no hardcoded prefixes)', () => {
  const brand = resolveBrand({});
  assert.equal(modeForHost('kiwiadmin.gothwadtech.com', brand), 'admin');
  assert.equal(modeForHost('KIWISTORE.gothwadtech.com.', brand), 'store');
  assert.equal(modeForHost('kiwiapp.gothwadtech.com', brand), 'storeapp');
  assert.equal(modeForHost('anything.pages.dev', brand), null);
  // Purane domains ab koi site nahi hain - preview/local gating isi par chalti hai.
  assert.equal(modeForHost('store.gothwadtech.com', brand), null);
});

test('manifest, SEO copy and index.html tokens all follow the app name', () => {
  const brand = resolveBrand({ VITE_APP_NAME: 'Mango Store', VITE_APP_SHORT_NAME: 'Mango' });
  const manifest = manifestFor(brand);
  assert.equal(manifest.name, 'Mango Store');
  assert.equal(manifest.short_name, 'Mango');
  for (const mode of SITE_MODES) {
    const seo = seoFor(mode, brand);
    assert.match(seo.title, /Mango/);
    assert.doesNotMatch(`${seo.title} ${seo.description}`, /Gothwad Store/);
  }

  const html = renderIndexHtml(read('index.html'), brand);
  assert.doesNotMatch(html, /%[A-Z][A-Z0-9_]*%/, 'unresolved token left in index.html');
  assert.ok(html.includes('<title>Mango Store | Android Apps &amp; Games</title>'));
  assert.ok(html.includes('content="https://kiwistore.gothwadtech.com/"'));
  assert.doesNotMatch(html, /Gothwad Store/);
});

test('index.html itself hardcodes no brand name and no domain', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /gothwadtech\.com/i);
  assert.doesNotMatch(html, /Kiwi|Gothwad/);
});

test('app and worker source hardcode no production URL', () => {
  const files = [...walk('src'), ...walk('worker/src')];
  assert.ok(files.length > 10, 'expected to scan the app source tree');
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /https?:\/\/[a-z0-9.-]*gothwadtech\.com/i,
      `${file} hardcodes a gothwadtech.com URL - use shared/brand.ts + env`,
    );
    assert.doesNotMatch(
      source,
      /(?<![a-z0-9-])(store|console|storeadmin|storeapp)\.gothwadtech\.com/i,
      `${file} still references an old Store domain`,
    );
  }
});

test('worker config uses the kiwi hosts and keeps the same worker name', () => {
  const toml = read('worker/wrangler.toml');
  assert.match(toml, /^name = "store"$/m, 'Worker ka naam "store" hi rehna chahiye');
  for (const [key, value] of Object.entries({
    APP_NAME: 'Kiwi Store',
    APP_DOMAIN: 'gothwadtech.com',
    STORE_HOST: 'kiwistore',
    CONSOLE_HOST: 'kiwiconsole',
    ADMIN_HOST: 'kiwiadmin',
    STOREAPP_HOST: 'kiwiapp',
    OAUTH_CLIENT_ID: 'kiwi-store',
  })) {
    assert.match(toml, new RegExp(`^${key} = "${value}"$`, 'm'), `${key} should be ${value}`);
  }
  assert.doesNotMatch(
    toml,
    /(?<![a-z0-9-])(store|console|storeadmin|storeapp)\.gothwadtech\.com/,
    'wrangler.toml still references an old domain',
  );
});
