// Built bundle ko jsdom me chala kar chaaro surfaces ka render verify karta hai.
// Chalane ka tarika:  npm run test:ui   (pehle `vite build` hota hai)
// Har case alag process me chalta hai (lazy chunks ki React copy alag na ho).
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { pathToFileURL } from 'node:url';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = process.argv[2] ?? resolve(repoRoot, 'dist');
const bundle = readdirSync(`${dist}/assets`).find((f) => /^index-.*\.js$/.test(f));
const bundleUrl = pathToFileURL(`${dist}/assets/${bundle}`).href;

const now = new Date().toISOString();
const app = {
  id: 'app-1', packageName: 'com.gothwad.store', name: 'Kiwi Store', developerId: 'dev-1',
  developerName: 'Kiwi Tech', developerVerified: true, category: 'tools', kind: 'app',
  status: 'published', shortDesc: 'Discover apps', fullDesc: 'Full description here.',
  iconUrl: '/assets/icon-512.png', iconColor: '#0284c7', screenshots: ['/assets/icon-512.png'],
  tags: ['store'], supportEmail: 'support@example.test', ratingAvg: 4.6, ratingCount: 120,
  downloadsCount: 25000, featured: 'hero', createdAt: now, updatedAt: now,
};
const app2 = { ...app, id: 'app-2', packageName: 'com.gothwad.browser', name: 'Kiwi Browser', category: 'browser', featured: undefined, kind: 'app' };
const release = {
  id: 'rel-1', appId: 'app-1', versionCode: 12, versionName: '1.2.0', apkProvider: 'github',
  apkKey: 'k', apkUrl: 'https://files.test/a.apk', apkSizeBytes: 5242880,
  permissions: ['android.permission.INTERNET'], changelog: 'Bug fixes', reviewStatus: 'approved',
  isLive: true, createdAt: now, downloads: 900,
};
const review = { id: 'rev-1', appId: 'app-1', userId: 'u1', username: 'amit', rating: 5, body: 'Great app', createdAt: now };
const developer = { id: 'dev-1', userId: 'u1', username: 'pawan', displayName: 'Pawan', orgName: 'Kiwi Tech', supportEmail: 'pawan@example.test', verified: true, createdAt: now };
const submission = { id: 'sub-1', appId: 'app-1', appName: 'Kiwi Store', packageName: 'com.gothwad.store', developerId: 'dev-1', developerName: 'Kiwi Tech', releaseId: 'rel-1', versionName: '1.2.0', versionCode: 12, apkSizeBytes: 5242880, apkProvider: 'github', status: 'pending', submittedAt: now };
const report = { id: 'rep-1', appId: 'app-1', appName: 'Kiwi Store', reporter: 'amit', reason: 'Broken', details: 'Crashes', status: 'open', createdAt: now };
const categories = [{ slug: 'tools', name: 'Tools', kind: 'both', icon: 'Wrench' }, { slug: 'browser', name: 'Browsers', kind: 'app', icon: 'Globe' }];

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
function stubFetch(url) {
  const path = String(url).replace(/^https?:\/\/[^/]+/, '');
  if (path.startsWith('/api/me')) return json({ user: { id: 'u1', username: 'pawan', name: 'Pawan', email: 'pawan@example.test' }, developer, isAdmin: true, configured: { supabase: true } });
  if (path.startsWith('/api/store/categories')) return json({ categories });
  if (path.startsWith('/api/store/apps')) return json({ apps: [app, app2], releases: [release], reviews: [review] });
  if (path.startsWith('/api/store/library') || path.startsWith('/api/store/wishlist')) return json({ appIds: ['app-1'] });
  if (/^\/api\/dev\/apps\/[^/]+\/stats/.test(path)) {
    const days = Array.from({ length: 7 }, (_, n) => ({ date: new Date(Date.now() - (6 - n) * 864e5).toISOString().slice(0, 10), count: 10 + n }));
    return json({ days, totalDownloads: 25000, ratingAvg: 4.6, ratingCount: 120 });
  }
  if (path.startsWith('/api/dev/apps')) return json({ developer, apps: [app, app2], releases: [release], reviews: [review], submissions: [submission] });
  if (path.startsWith('/api/admin/queue')) return json({ submissions: [submission], apps: [app, app2], releases: [release] });
  if (path.startsWith('/api/admin/apps')) return json({ apps: [app, app2], releases: [release], submissions: [submission] });
  if (path.startsWith('/api/admin/reports')) return json({ reports: [report] });
  return json({ ok: true });
}

const CASES = [
  { name: 'store (kiwistore)', url: 'https://kiwistore.gothwadtech.com/', expect: ['Kiwi Store', 'Suggested for you', 'Top charts'], both: ['aria-label="Primary"', 'safe-bottom fixed inset-x-0 bottom-0', 'hidden items-center gap-0.5 lg:flex'] },
  { name: 'app detail', url: 'https://kiwistore.gothwadtech.com/app/com.gothwad.store', expect: ['About this app', 'Ratings & reviews', 'Install'], both: ['fixed inset-x-0 bottom-[68px]', 'hidden flex-wrap gap-3 sm:flex'] },
  { name: 'library', url: 'https://kiwistore.gothwadtech.com/library', expect: ['My library', 'Wishlist'] },
  { name: 'console (kiwiconsole)', url: 'https://kiwiconsole.gothwadtech.com/', expect: ['Dashboard', 'Your apps', 'Total downloads'], both: ['aria-label="Open console menu"', 'sticky top-0 hidden h-dvh w-[268px]', 'divide-y divide-white/[0.06] md:hidden'] },
  { name: 'console releases', url: 'https://kiwiconsole.gothwadtech.com/apps/app-1/releases', expect: ['Upload a new release', 'Release history'] },
  { name: 'console stats', url: 'https://kiwiconsole.gothwadtech.com/stats', expect: ['Statistics', 'Downloads (7 days)'] },
  { name: 'admin (kiwiadmin)', url: 'https://kiwiadmin.gothwadtech.com/', expect: ['Review queue', 'Approve and publish', 'In queue'], both: ['aria-label="Open menu"', 'hidden h-dvh w-[268px] shrink-0 flex-col border-r'] },
  { name: 'store app landing (kiwiapp)', url: 'https://kiwiapp.gothwadtech.com/', expect: ['in one place.', 'Download the APK', 'Are you a developer?'], both: ['safe-bottom sticky bottom-0', 'lg:grid-cols-2'] },
];

// Bina index ke: har case ko alag child process me chalao (React ki ek hi copy
// per process, warna lazy chunks "invalid hook call" dete hain).
if (process.argv[3] === undefined) {
  const { spawnSync } = await import('node:child_process');
  let failed = 0;
  for (let i = 0; i < CASES.length; i += 1) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), dist, String(i)], { stdio: 'inherit' });
    if (run.status !== 0) failed += 1;
  }
  console.log(failed ? `\n${failed} render case(s) failed` : `\nAll ${CASES.length} render cases passed`);
  process.exit(failed ? 1 : 0);
}

const only = Number(process.argv[3]);
let failures = 0;
for (let i = 0; i < CASES.length; i += 1) {
  if (only !== i) continue;
  const c = CASES[i];
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
  vc.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`));
  const dom = new JSDOM(readFileSync(`${dist}/index.html`, 'utf8'), {
    url: c.url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  w.fetch = stubFetch;
  w.matchMedia ??= (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.crypto ??= globalThis.crypto;
  w.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  w.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  for (const key of ['window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia', 'crypto', 'ResizeObserver', 'fetch', 'MutationObserver', 'IntersectionObserver', 'DOMParser', 'SVGElement', 'Text', 'DocumentFragment', 'Image', 'URLSearchParams', 'AbortController']) {
    Object.defineProperty(globalThis, key, { value: w[key], configurable: true, writable: true });
  }
  try {
    await import(bundleUrl);
  } catch (e) {
    errors.push(`import threw: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
  const html = w.document.getElementById('root')?.innerHTML ?? '';
  const responsive = c.both ?? [];
  const missingResponsive = responsive.filter((t) => !html.includes(t));
  const missing = c.expect.filter((t) => !html.includes(t) && !html.includes(t.replace(/ & /g, ' &amp; ')));
  const ok = errors.length === 0 && missing.length === 0 && missingResponsive.length === 0 && html.length > 400;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(30)} html=${String(html.length).padStart(6)} bytes` +
    (missing.length ? `  missing=${JSON.stringify(missing)}` : '') +
    (missingResponsive.length ? `  missingResponsive=${JSON.stringify(missingResponsive)}` : '') +
    (errors.length ? `  errors=${JSON.stringify(errors.slice(0, 2))}` : ''));
  dom.window.close();
}
if (failures) console.log('\ncase failed');
process.exit(failures ? 1 : 0);
