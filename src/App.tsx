import { lazy, Suspense, useLayoutEffect } from 'react';
import { detectMode, isProductionHostCheck, SITE_MODES, SITE_URLS } from './lib/config';
import type { SiteMode } from './lib/config';
import StoreApp from './store/StoreApp';

const ConsoleApp = lazy(() => import('./console/ConsoleApp'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const StoreAppLanding = lazy(() => import('./landing/StoreAppLanding'));

function DevModeSwitcher({ mode }: { mode: SiteMode }) {
  // Sirf preview/local par: 4 sites ek hi Pages preview me ghumane ke liye.
  if (isProductionHostCheck()) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 gap-1 rounded-full border border-white/15 bg-black/80 p-1 shadow-2xl backdrop-blur-xl lg:bottom-4">
      {SITE_MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => { localStorage.setItem('gothwad-site-mode', m.id); window.location.href = '/?mode=' + m.id; }}
          className={`rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap ${mode === m.id ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-white/10'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

const SEO_CONTENT: Record<SiteMode, { title: string; description: string }> = {
  store: {
    title: 'Gothwad Store | Android Apps & Games',
    description: 'Discover and download Android apps and games on Gothwad Store. Browse trusted listings and reviews from the Gothwad ecosystem.',
  },
  console: {
    title: 'Gothwad Developer Console',
    description: 'Publish Android apps to Gothwad Store. Manage app listings, APK releases, reviews, and developer account settings.',
  },
  admin: {
    title: 'Gothwad Store Admin',
    description: 'Administrative tools for reviewing and managing apps published on Gothwad Store.',
  },
  storeapp: {
    title: 'Gothwad Store App for Android',
    description: 'Download the official Gothwad Store app for Android and discover apps, games, and updates from the Gothwad ecosystem.',
  },
};

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function applySeoMetadata(mode: SiteMode) {
  const { title, description } = SEO_CONTENT[mode];
  const canonicalUrl = new URL(window.location.pathname || '/', `${SITE_URLS[mode]}/`).toString();
  const imageUrl = `${SITE_URLS.store}/assets/icon-512.png`;
  const robots = mode === 'console' || mode === 'admin' || !isProductionHostCheck()
    ? 'noindex,nofollow'
    : 'index,follow';

  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', robots);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', 'Gothwad Store');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:image', imageUrl);
  setMeta('property', 'og:image:secure_url', imageUrl);
  setMeta('property', 'og:image:type', 'image/png');
  setMeta('property', 'og:image:width', '512');
  setMeta('property', 'og:image:height', '512');
  setMeta('property', 'og:image:alt', 'Gothwad Store app icon');
  setMeta('name', 'twitter:card', 'summary');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', imageUrl);
  setMeta('name', 'twitter:image:alt', 'Gothwad Store app icon');

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;
}

export default function App() {
  const mode = detectMode();
  useLayoutEffect(() => { applySeoMetadata(mode); }, [mode]);
  const shell =
    mode === 'console' ? <ConsoleApp /> :
    mode === 'admin' ? <AdminApp /> :
    mode === 'storeapp' ? <StoreAppLanding /> :
    <StoreApp />;
  return (
    <>
      <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-[#212121] text-neutral-400">Loading Gothwad Store…</div>}>
        {shell}
      </Suspense>
      <DevModeSwitcher mode={mode} />
    </>
  );
}
