import { lazy, Suspense, useEffect } from 'react';
import { detectMode, isProductionHostCheck, SITE_MODES } from './lib/config';
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

const TITLES: Record<SiteMode, string> = {
  store: 'Gothwad Store',
  console: 'Gothwad Developer Console',
  admin: 'Gothwad Store Admin',
  storeapp: 'Gothwad Store - Android App',
};

export default function App() {
  const mode = detectMode();
  useEffect(() => { document.title = TITLES[mode]; }, [mode]);
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
