import { BadgeCheck, Download, MessageSquareText, Search, ShieldCheck, Smartphone, Star, Zap } from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { AppIcon, Logo } from '../shared/ui';
import { formatBytes, formatCount } from '../lib/storage';
import { SITE_URLS } from '../lib/config';

/** storeapp.gothwadtech.com - sirf Gothwad Store Android app ko download karne ka page */
export default function StoreAppLanding() {
  const { apps, liveReleaseOf } = useApp();
  const storeApp = apps.find((a) => a.packageName === 'com.gothwad.store') ?? apps[0];
  const rel = storeApp ? liveReleaseOf(storeApp.id) : undefined;

  const downloadStore = () => {
    if (storeApp) window.open(rel?.apkUrl ?? '/api/download/store-app', '_blank', 'noopener');
  };

  return (
    <div className="min-h-dvh bg-[#212121] text-neutral-200">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo subtitle="Android App" />
        <a href={SITE_URLS.store} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">Open the Web Store</a>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="grid items-center gap-10 pt-8 lg:grid-cols-2 lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/25"><Zap size={13} /> The official store of the Gothwad ecosystem</span>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl">Every Gothwad app,<br /><span className="bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">in one place.</span></h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-400">Download the Gothwad Store Android app — Browser, Manager, TV Launcher, and new apps from independent developers, delivered as direct APKs and connected to your Gothwad Account.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <button onClick={downloadStore} className="flex items-center gap-2.5 rounded-full bg-emerald-500 px-7 py-3.5 font-display text-base font-bold text-white shadow-2xl shadow-emerald-500/25 transition hover:bg-emerald-400">
                <Download size={20} /> Download the APK {rel ? `· ${formatBytes(rel.apkSizeBytes)}` : ''}
              </button>
              {storeApp && <span className="flex items-center gap-1.5 text-sm text-neutral-300">{storeApp.ratingAvg.toFixed(1)} <Star size={14} className="fill-amber-400 text-amber-400" /> · {formatCount(storeApp.downloadsCount)} downloads</span>}
            </div>
            <ul className="mt-7 space-y-2.5 text-sm text-neutral-300">
              <li className="flex gap-2"><ShieldCheck size={17} className="shrink-0 text-emerald-300" /> Every app is manually reviewed before it goes live</li>
              <li className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-emerald-300" /> Sign in with Gothwad — the same account you use for Mail and Drive</li>
              <li className="flex gap-2"><Smartphone size={17} className="shrink-0 text-emerald-300" /> Works on phones, tablets, and Android TV</li>
            </ul>
            <div className="mt-8 flex items-center gap-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white p-1.5">
                {/* QR code for storeapp.gothwadtech.com */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(SITE_URLS.storeapp)}`} alt="QR code - scan to open this page on your phone" className="h-full w-full rounded-lg" loading="lazy" />
              </div>
              <div><p className="font-display font-bold text-white">Scan with your phone 📱</p><p className="mt-0.5 text-[13px] leading-relaxed text-neutral-400">On a TV or computer? Scan this code to open the page on your phone, then install the APK from there.</p></div>
            </div>
          </div>

          {/* Phone mock */}
          <div className="mx-auto w-full max-w-[330px]">
            <div className="rounded-[42px] border border-white/15 bg-[#181818] p-2.5 shadow-2xl shadow-black/60">
              <div className="overflow-hidden rounded-[34px] bg-[#212121]">
                <div className="flex items-center justify-between px-5 pb-2 pt-4"><Logo subtitle="Store" /><span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold text-white">P</span></div>
                <div className="mx-4 flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-2 text-xs text-neutral-500"><Search size={13} /> Search apps & games</div>
                <p className="px-5 pb-2 pt-4 font-display text-[15px] font-bold text-white">Suggested for you</p>
                <div className="space-y-1 px-2 pb-3">
                  {apps.filter((a) => a.status === 'published').slice(0, 4).map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-2xl px-3 py-2">
                      <AppIcon app={a} size={42} rounded="rounded-[11px]" />
                      <span className="min-w-0 flex-1"><b className="line-clamp-1 block text-[13px] text-white">{a.name}</b><i className="line-clamp-1 block text-[11px] not-italic text-neutral-500">{a.shortDesc}</i></span>
                      <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold text-emerald-300">GET</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 border-t border-white/[0.07] px-2 py-2.5 text-center text-[9px] text-neutral-500">
                  <span className="text-emerald-300">For you</span><span>Games</span><span>Search</span><span>Library</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-neutral-600">The Android app uses this same Worker API and is being built in the storeapp repository</p>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            [Search, 'Find apps faster', 'Search by name, category, or developer. Top charts and curated collections are refreshed regularly.'],
            [MessageSquareText, 'Reviews you can trust', 'Ratings and reviews from real users — and developers can reply directly.'],
            [ShieldCheck, 'Safe downloads', 'Every APK passes manual review and carries a SHA-256 fingerprint. Something wrong? Report it in one tap.'],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Search;
            return <article key={t as string} className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6"><I size={26} className="text-emerald-300" /><h2 className="mt-3.5 font-display text-lg font-bold text-white">{t as string}</h2><p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{d as string}</p></article>;
          })}
        </section>

        <section className="mt-16 rounded-[28px] bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent p-8 text-center ring-1 ring-emerald-400/20">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Are you a developer? Publish your app</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-300">Upload your APK from the Developer Console — up to 25 MB on GitHub, larger files on Backblaze. After review, your app is live for everyone.</p>
          <a href={SITE_URLS.console} className="mt-5 inline-block rounded-full bg-emerald-500 px-7 py-3 font-display font-bold text-white shadow-xl shadow-emerald-500/25 hover:bg-emerald-400">Open the Developer Console</a>
        </section>
      </main>
      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-neutral-600">© 2026 Gothwad Tech · Made in India 🇮🇳 · <a className="hover:text-neutral-300" href={SITE_URLS.store}>store.gothwadtech.com</a></footer>
    </div>
  );
}
