import { BadgeCheck, Download, MessageSquareText, Search, ShieldCheck, Smartphone, Star, UserRound, Zap } from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { AppIcon, Button, Logo, Pill, SiteFooter } from '../shared/ui';
import { BackendNotice } from '../shared/BackendNotice';
import { formatBytes, formatCount } from '../lib/storage';
import {
  APP_NAME,
  ECOSYSTEM_NAME,
  SITE_HOSTS,
  SITE_URLS,
  STOREAPP_PACKAGE,
} from '../lib/config';

/**
 * Store App landing page (kiwiapp.*) — dedicated download page for the native Android client.
 * Brand and domain names come from shared/brand.ts rather than hardcoded strings.
 */
export default function StoreAppLanding() {
  const { apps, liveReleaseOf } = useApp();
  const storeApp = apps.find((app) => app.packageName === STOREAPP_PACKAGE);
  const rel = storeApp ? liveReleaseOf(storeApp.id) : undefined;
  const previewApps = apps.filter((app) => app.status === 'published').slice(0, 4);

  const downloadStore = () => {
    if (rel?.apkUrl) window.open(rel.apkUrl, '_blank', 'noopener,noreferrer');
  };

  const highlights = [
    [Search, 'Find apps faster', 'Search by name, category, or developer. Top charts and curated collections are refreshed regularly.'],
    [MessageSquareText, 'Reviews you can trust', 'Ratings and reviews from real users — and developers can reply directly.'],
    [ShieldCheck, 'Reviewed downloads', 'Every release is manually reviewed before publishing. SHA-256 fingerprints are shown when available, and users can report a problem at any time.'],
  ] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-[#212121] text-neutral-200">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#212121]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo subtitle="Android App" />
          <a href={SITE_URLS.store}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/5">
            Open the Web Store
          </a>
        </div>
      </header>

      <BackendNotice />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/12 blur-3xl" />
            <div className="absolute -right-16 top-24 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
          </div>
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:pb-24 lg:pt-16">
            <div>
              <Pill tone="emerald" className="px-3 py-1"><Zap size={12} /> The official store of the {ECOSYSTEM_NAME} ecosystem</Pill>
              <h1 className="mt-5 font-display text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-6xl">
                Every {ECOSYSTEM_NAME} app,<br />
                <span className="bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">in one place.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-neutral-400 sm:text-[17px]">
                Download the {APP_NAME} Android app — Browser, Manager, TV Launcher, and new apps from independent
                developers, delivered as direct APKs and connected to your {ECOSYSTEM_NAME} Account.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Button variant="primary" size="lg" pill disabled={!rel?.apkUrl} onClick={downloadStore} className="px-8 shadow-2xl shadow-emerald-500/25">
                  <Download size={20} /> {rel?.apkUrl ? `Download the APK · ${formatBytes(rel.apkSizeBytes)}` : 'APK not available yet'}
                </Button>
                {storeApp && (
                  <span className="flex items-center gap-1.5 text-sm text-neutral-300">
                    {storeApp.ratingAvg.toFixed(1)} <Star size={14} className="fill-amber-400 text-amber-400" /> · {formatCount(storeApp.downloadsCount)} downloads
                  </span>
                )}
              </div>

              <ul className="mt-8 space-y-3 text-sm text-neutral-300">
                <li className="flex gap-2.5"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-300" /> Every app is manually reviewed before it goes live</li>
                <li className="flex gap-2.5"><BadgeCheck size={17} className="mt-0.5 shrink-0 text-emerald-300" /> One {ECOSYSTEM_NAME} Account across Store, Mail, and Drive</li>
                <li className="flex gap-2.5"><Smartphone size={17} className="mt-0.5 shrink-0 text-emerald-300" /> Works on phones, tablets, and Android TV</li>
              </ul>

              <div className="mt-9 flex items-center gap-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white p-1.5">
                  {/* QR code points to the configured Store App URL (SITE_URLS.storeapp) */}
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(SITE_URLS.storeapp)}`}
                    alt="QR code - scan to open this page on your phone" className="h-full w-full rounded-lg" loading="lazy" width={120} height={120} />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-white">Scan with your phone 📱</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                    On a TV or computer? Scan this code to open <span className="text-neutral-300">{SITE_HOSTS.storeapp}</span> on your phone, then install the APK from there.
                  </p>
                </div>
              </div>
            </div>

            {/* Phone mock */}
            <div className="mx-auto w-full max-w-[330px]">
              <div className="rounded-[42px] border border-white/15 bg-[#181818] p-2.5 shadow-2xl shadow-black/60">
                <div className="overflow-hidden rounded-[34px] bg-[#212121]">
                  <div className="flex items-center justify-between px-5 pb-2 pt-4">
                    <Logo subtitle="Store" />
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-neutral-300"><UserRound size={14} /></span>
                  </div>
                  <div className="mx-4 flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-2 text-xs text-neutral-500">
                    <Search size={13} /> Search apps &amp; games
                  </div>
                  <p className="px-5 pb-2 pt-4 font-display text-[15px] font-bold text-white">Suggested for you</p>
                  <div className="space-y-1 px-2 pb-3">
                    {previewApps.map((app) => (
                      <div key={app.id} className="flex items-center gap-3 rounded-2xl px-3 py-2">
                        <AppIcon app={app} size={42} rounded="rounded-[11px]" />
                        <span className="min-w-0 flex-1">
                          <b className="line-clamp-1 block text-[13px] text-white">{app.name}</b>
                          <i className="line-clamp-1 block text-[11px] not-italic text-neutral-500">{app.shortDesc}</i>
                        </span>
                        <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold text-emerald-300">GET</span>
                      </div>
                    ))}
                    {!previewApps.length && <p className="px-3 py-6 text-center text-xs text-neutral-500">Published apps will appear here.</p>}
                  </div>
                  <div className="grid grid-cols-4 border-t border-white/[0.07] px-2 py-2.5 text-center text-[9px] text-neutral-500">
                    <span className="text-emerald-300">For you</span><span>Games</span><span>Search</span><span>Library</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-center text-xs leading-relaxed text-neutral-600">
                The Android app uses this same Worker API and is being built in the storeapp repository
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {highlights.map(([Icon, title, desc]) => (
              <article key={title} className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 transition hover:border-white/[0.14] hover:bg-white/[0.05]">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/12 text-emerald-300"><Icon size={22} /></span>
                <h2 className="mt-4 font-display text-lg font-bold text-white">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Developer CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:pb-28">
          <div className="rounded-[28px] bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent p-8 text-center ring-1 ring-emerald-400/20 sm:p-12">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">Are you a developer? Publish your app</h2>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-neutral-300">
              Upload your APK from the Developer Console — up to 50 MB on GitHub storefiles with live progress.
              After review, your app is live for everyone.
            </p>
            <a href={SITE_URLS.console}
              className="mt-6 inline-block rounded-full bg-emerald-500 px-7 py-3 font-display font-bold text-[#08130e] shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400">
              Open the Developer Console
            </a>
          </div>
        </section>
      </main>

      <SiteFooter note={`© 2026 ${ECOSYSTEM_NAME} Tech · Made in India 🇮🇳`}>
        <a className="transition hover:text-neutral-200" href={SITE_URLS.store}>{SITE_HOSTS.store}</a>
        <a className="transition hover:text-neutral-200" href={SITE_URLS.console}>{SITE_HOSTS.console}</a>
      </SiteFooter>

      {/* Mobile sticky download bar */}
      <div className="safe-bottom sticky bottom-0 z-30 border-t border-white/[0.08] bg-[#1e1e1e]/95 px-4 py-3 backdrop-blur-xl sm:hidden">
        <Button variant="primary" size="md" pill full disabled={!rel?.apkUrl} onClick={downloadStore}>
          <Download size={18} /> {rel?.apkUrl ? `Get ${APP_NAME}` : 'APK not available yet'}
        </Button>
      </div>
    </div>
  );
}
