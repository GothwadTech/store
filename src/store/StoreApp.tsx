import { useEffect, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Bookmark, BookmarkCheck, Download, Flag, Gamepad2, Home,
  LayoutGrid, Library, Search, ShieldCheck, Star, Trophy, X,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { fetchAppDetail } from '../lib/api';
import { usePath } from '../lib/router';
import {
  AccountMenu, AppIcon, Avatar, Button, EmptyState, Logo, Pill, SectionTitle,
  SiteFooter, Skeleton, SourceBadge, Stars, categoryName, cx, isFdroidApp,
} from '../shared/ui';
import { BackendNotice } from '../shared/BackendNotice';
import { formatBytes, formatCount } from '../lib/storage';
import { startGothwadSignIn } from '../lib/auth';
import { APP_NAME, ECOSYSTEM_NAME, SITE_URLS } from '../lib/config';
import type { AppRelease, Review, StoreApp as StoreAppType } from '../types';
import { CallbackPage, HomePage, LibraryPage, ListPage, Rail, SearchPage } from './StorePages';

const NAV: [string, string, typeof Home][] = [
  ['/', 'For you', Home],
  ['/apps', 'Apps', LayoutGrid],
  ['/games', 'Games', Gamepad2],
  ['/fdroid', 'F-Droid', ShieldCheck],
  ['/charts', 'Top charts', Trophy],
  ['/library', 'Library', Library],
];

const MOBILE_TABS: [string, string, typeof Home][] = [
  ['/', 'For you', Home],
  ['/apps', 'Apps', LayoutGrid],
  ['/games', 'Games', Gamepad2],
  ['/search', 'Search', Search],
  ['/library', 'Library', Library],
];

function Header({ navigate, path }: { navigate: (p: string) => void; path: string }) {
  const { user, authReady, demoModeAvailable, signInDemo } = useApp();
  const [q, setQ] = useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); };
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#212121]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <button onClick={() => navigate('/')} aria-label={`${APP_NAME} home`} className="shrink-0 rounded-lg">
          <Logo subtitle="Store" />
        </button>

        <form onSubmit={submit} className="ml-auto hidden w-full max-w-md items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 ring-1 ring-white/[0.07] transition focus-within:bg-white/[0.08] focus-within:ring-emerald-400/50 md:flex lg:ml-6">
          <Search size={17} className="shrink-0 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Kiwi Store & F-Droid" aria-label="Search apps and games"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={15} className="text-neutral-400 hover:text-white" /></button>}
        </form>

        <nav className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {NAV.map(([to, label, Icon]) => (
            <button key={to} onClick={() => navigate(to)} aria-current={path === to ? 'page' : undefined}
              className={cx('flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition',
                path === to ? 'bg-emerald-500/15 font-semibold text-emerald-300' : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white')}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-3">
          {!authReady ? (
            <Skeleton className="h-9 w-9 rounded-full" />
          ) : user ? (
            <AccountMenu />
          ) : (
            <>
              <Button variant="primary" size="sm" pill onClick={() => { void startGothwadSignIn(); }}>Sign in</Button>
              {demoModeAvailable && <button onClick={signInDemo} className="hidden rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/5 sm:block">Demo</button>}
            </>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="px-4 pb-3 md:hidden">
        <label className="flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 ring-1 ring-white/[0.07] focus-within:ring-emerald-400/50">
          <Search size={16} className="shrink-0 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Kiwi Store & F-Droid" aria-label="Search apps and games"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" />
        </label>
      </form>
    </header>
  );
}

function BottomNav({ navigate, path }: { navigate: (p: string) => void; path: string }) {
  return (
    <nav aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.08] bg-[#1e1e1e]/95 backdrop-blur-xl lg:hidden">
      {MOBILE_TABS.map(([to, label, Icon]) => {
        const active = to === '/search' ? path.startsWith('/search') : path === to;
        return (
          <button key={to} onClick={() => navigate(to)} aria-current={active ? 'page' : undefined}
            className={cx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition', active ? 'text-emerald-300' : 'text-neutral-500 hover:text-neutral-300')}>
            <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', active && 'bg-emerald-500/15')}>
              <Icon size={19} />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function DetailPage({
  app,
  navigate,
  releaseOverride,
  reviewsOverride,
}: {
  app: StoreAppType;
  navigate: (p: string) => void;
  releaseOverride?: AppRelease | null;
  reviewsOverride?: Review[];
}) {
  const ctx = useApp();
  const { user, reviews, wishlist, toggleWishlist, liveReleaseOf, addReview, reportApp, backendLive, demoModeAvailable, isDemoUser, recordDownload, signInDemo } = ctx;
  const fdroid = isFdroidApp(app);
  const canPreviewDownload = demoModeAvailable && isDemoUser;
  const rel = releaseOverride ?? liveReleaseOf(app.id);
  const appReviews = reviewsOverride ?? reviews.filter((r) => r.appId === app.id);
  const wished = wishlist.includes(app.id);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [toast, setToast] = useState('');
  const similar = ctx.apps.filter((a) => a.status === 'published' && a.id !== app.id && a.category === app.category);
  const installDisabled = !canPreviewDownload && ((!backendLive && !fdroid) || !rel?.apkUrl);

  const download = () => {
    if (canPreviewDownload) {
      void recordDownload(app);
      setToast('Preview download simulated. Sample listings do not contain a real APK.');
      return;
    }
    if ((!backendLive && !fdroid) || !rel?.apkUrl) {
      setToast('A downloadable APK is not available for this app yet.');
      return;
    }
    window.open(rel.apkUrl, '_blank', 'noopener,noreferrer');
    setToast(fdroid ? 'Downloading signed open-source APK from F-Droid…' : 'Your download is starting.');
  };

  const wishlistClick = () => {
    if (!user) {
      if (demoModeAvailable) {
        signInDemo();
        void toggleWishlist(app.id).catch((error: Error) => setToast(error.message));
      } else void startGothwadSignIn();
      return;
    }
    void toggleWishlist(app.id).catch((error: Error) => setToast(error.message));
  };

  const stats: [string, string][] = [
    [app.ratingAvg.toFixed(1), fdroid ? 'FOSS rating' : `${formatCount(app.ratingCount)} reviews`],
    [fdroid ? (app.license || 'FOSS') : formatCount(app.downloadsCount), fdroid ? 'License' : 'Downloads'],
    [rel ? formatBytes(rel.apkSizeBytes) : '—', 'Size'],
    [rel ? `v${rel.versionName}` : '—', 'Version'],
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:pb-28">
      <button onClick={() => navigate('/')} className="mb-5 flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <AppIcon app={app} size={112} rounded="rounded-[28px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">{app.name}</h1>
            <SourceBadge app={app} />
          </div>
          <button onClick={() => navigate(fdroid ? '/fdroid' : `/developer/${app.developerId}`)} className="mt-1.5 flex items-center gap-1 text-sm font-medium text-emerald-300 transition hover:text-emerald-200 hover:underline">
            {app.developerName} {app.developerVerified && <BadgeCheck size={15} className="fill-emerald-400 text-[#212121]" />}
          </button>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-neutral-500">
            <span>{categoryName(app.category)}</span><span aria-hidden="true">·</span>
            <span>{app.kind === 'game' ? 'Game' : 'App'}</span><span aria-hidden="true">·</span>
            <span className="break-all">{app.packageName}</span>
          </p>
          <dl className="mt-5 grid max-w-lg grid-cols-2 gap-x-4 gap-y-3 border-y border-white/[0.07] py-4 sm:grid-cols-4">
            {stats.map(([value, label], i) => (
              <div key={label} className="text-center sm:text-left">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <b className="flex items-center justify-center gap-1 text-[15px] font-semibold text-white sm:justify-start">
                    {value} {i === 0 && <Star size={13} className="fill-white" />}
                  </b>
                  <span className="mt-0.5 block text-[11px] text-neutral-500">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-6 hidden flex-wrap gap-3 sm:flex">
        <Button variant="primary" size="lg" pill disabled={installDisabled} onClick={download} className="sm:px-12">
          <Download size={19} /> {canPreviewDownload ? 'Try preview download' : rel?.apkUrl ? (fdroid ? 'Download APK (F-Droid)' : 'Install') : 'APK unavailable'}
        </Button>
        <Button variant="secondary" size="lg" pill onClick={wishlistClick}>
          {wished ? <BookmarkCheck size={18} className="text-emerald-300" /> : <Bookmark size={18} />} {wished ? 'Wishlisted' : 'Wishlist'}
        </Button>
      </div>
      {toast && <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 ring-1 ring-emerald-400/20">{toast}</p>}

      {app.screenshots.length > 0 && (
        <div className="rail no-scrollbar -mx-4 mt-8 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          {app.screenshots.map((s, i) => (
            <img key={i} src={s} alt={`${app.name} screenshot ${i + 1}`}
              className="h-72 w-40 shrink-0 rounded-2xl object-cover ring-1 ring-white/10 sm:h-80 sm:w-44" loading="lazy" />
          ))}
        </div>
      )}

      <section className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <h2 className="font-display text-xl font-bold tracking-tight text-white">About this {app.kind === 'game' ? 'game' : 'app'}</h2>
          <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-neutral-300">{app.fullDesc || app.shortDesc}</p>
          {rel?.changelog && (
            <>
              <h3 className="mt-7 font-display font-bold text-white">What's new</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{rel.changelog}</p>
            </>
          )}
          <h3 className="mt-8 flex items-center gap-2 font-display font-bold text-white">
            <ShieldCheck size={18} className="text-emerald-300" /> Data safety & permissions
          </h3>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {rel?.permissions.length
              ? rel.permissions.map((permission) => <li key={permission} className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 font-mono text-[11px] text-neutral-300">{permission}</li>)
              : <li className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-neutral-400">No special permissions required.</li>}
          </ul>
          {rel?.apkSha256 && <p className="mt-2.5 break-all font-mono text-[11px] text-neutral-600">SHA-256: {rel.apkSha256}</p>}
          {user && !fdroid && (
            <button onClick={() => { void reportApp(app, 'Other', '').then(() => setToast('Report submitted. Our team will review it. Thank you.')).catch((err: Error) => setToast(err.message)); }}
              className="mt-7 flex items-center gap-1.5 text-xs text-neutral-500 transition hover:text-red-300">
              <Flag size={13} /> Report this app
            </button>
          )}
        </div>

        <aside className="h-fit rounded-3xl border border-white/[0.08] bg-[#262626]/70 p-5">
          <h3 className="font-display font-bold text-white">{fdroid ? 'Open-Source Info' : 'Developer'}</h3>
          <button onClick={() => navigate(fdroid ? '/fdroid' : `/developer/${app.developerId}`)} className="mt-1 text-sm font-medium text-emerald-300 transition hover:underline">{app.developerName}</button>
          <dl className="mt-3.5 space-y-2.5 text-[13px]">
            {fdroid ? (
              <>
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">Source</dt><dd className="text-teal-300">F-Droid (f-droid.org)</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">License</dt><dd className="text-neutral-200">{app.license || 'FOSS'}</dd></div>
                {(app.sourceCodeUrl || app.website) && (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-neutral-500">Source Code</dt>
                    <dd className="truncate"><a href={app.sourceCodeUrl || app.website} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">{app.sourceCodeUrl || app.website}</a></dd>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between gap-3"><dt className="text-neutral-500">Support</dt><dd className="truncate text-neutral-200">{app.supportEmail}</dd></div>
                {app.website && <div className="flex justify-between gap-3"><dt className="shrink-0 text-neutral-500">Website</dt><dd className="truncate text-neutral-200">{app.website}</dd></div>}
              </>
            )}
            <div className="flex justify-between gap-3"><dt className="text-neutral-500">Updated</dt><dd className="text-neutral-200">{new Date(app.updatedAt).toLocaleDateString('en-IN')}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold tracking-tight text-white">Ratings & reviews</h2>
        <div className="mt-4 grid gap-8 md:grid-cols-[180px_1fr]">
          <div className="text-center md:text-left">
            <p className="font-display text-5xl font-bold text-white tabular-nums">{app.ratingAvg.toFixed(1)}</p>
            <Stars value={app.ratingAvg} size={16} />
            <p className="mt-1.5 text-xs text-neutral-500">{formatCount(app.ratingCount)} verified ratings</p>
          </div>
          <div>
            {user && !fdroid ? (
              <form className="mb-6 rounded-2xl border border-white/[0.08] bg-[#262626]/70 p-4"
                onSubmit={(e) => { e.preventDefault(); void addReview(app.id, rating, body).then(() => setBody('')).catch((err: Error) => setToast(err.message)); }}>
                <p className="text-sm font-semibold text-white">Write your review, @{user.username}</p>
                <div className="mt-2.5 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} star`} className="rounded transition hover:scale-110">
                      <Star size={26} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-600'} />
                    </button>
                  ))}
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} placeholder="What did you think of this app?"
                  className="mt-3 w-full rounded-xl bg-black/25 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 transition placeholder:text-neutral-500 focus:ring-emerald-400/50" />
                <div className="mt-3 flex justify-end">
                  <Button type="submit" variant="primary" size="sm" pill>Post review</Button>
                </div>
              </form>
            ) : !user && !fdroid ? (
              <button onClick={() => { if (demoModeAvailable) signInDemo(); else void startGothwadSignIn(); }}
                className="mb-6 w-full rounded-2xl border border-dashed border-white/15 px-4 py-4 text-sm text-neutral-300 transition hover:border-emerald-400/40 hover:bg-white/[0.03]">
                {demoModeAvailable ? 'Try demo mode to write a review' : 'Sign in to write a review'}
              </button>
            ) : null}
            <div className="space-y-5">
              {appReviews.map((r) => (
                <article key={r.id} className="border-b border-white/[0.06] pb-5 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.username} size={32} />
                    <b className="text-sm text-white">@{r.username}</b>
                    <Stars value={r.rating} size={11} />
                    <span className="ml-auto text-[11px] text-neutral-600">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">{r.body}</p>
                </article>
              ))}
              {!appReviews.length && <p className="text-sm text-neutral-500">{fdroid ? 'Open-source package built and signed by F-Droid.' : 'No reviews yet. Be the first to write one.'}</p>}
            </div>
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="mt-12">
          <SectionTitle title="Similar apps" />
          <Rail apps={similar} onOpen={(a) => navigate(`/app/${a.packageName}`)} />
        </section>
      )}

      <div className="safe-bottom fixed inset-x-0 bottom-[68px] z-30 border-t border-white/[0.08] bg-[#1e1e1e]/95 px-4 py-3 backdrop-blur-xl sm:hidden">
        <div className="flex items-center gap-2.5">
          <Button variant="primary" size="md" pill full disabled={installDisabled} onClick={download}>
            <Download size={18} /> {canPreviewDownload ? 'Preview download' : rel?.apkUrl ? (fdroid ? 'Download (F-Droid)' : 'Install') : 'APK unavailable'}
          </Button>
          <Button variant="secondary" size="md" pill onClick={wishlistClick} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}>
            {wished ? <BookmarkCheck size={18} className="text-emerald-300" /> : <Bookmark size={18} />}
          </Button>
        </div>
      </div>
    </main>
  );
}

function ResolvedDetailPage({ pkg, navigate }: { pkg: string; navigate: (p: string) => void }) {
  const { apps } = useApp();
  const clean = pkg.replace(/^fdroid:/i, '');
  const localApp = apps.find(
    (a) => a.status === 'published' && (a.packageName === clean || a.id === pkg || a.id === `fdroid:${clean}`),
  );
  const [remote, setRemote] = useState<{ app: StoreAppType; liveRelease: AppRelease | null; reviews: Review[] } | null>(null);
  const [loading, setLoading] = useState(!localApp);

  useEffect(() => {
    if (localApp) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchAppDetail(pkg).then((res) => {
      if (!cancelled) {
        if (res?.app) setRemote({ app: res.app, liveRelease: res.liveRelease, reviews: res.reviews ?? [] });
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pkg, localApp]);

  if (localApp) return <DetailPage app={localApp} navigate={navigate} />;
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-16"><Skeleton className="h-48 w-full rounded-3xl" /></main>;
  if (remote) return <DetailPage app={remote.app} releaseOverride={remote.liveRelease} reviewsOverride={remote.reviews} navigate={navigate} />;
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState icon={Search} title="App not found" desc="This app was not found, or it is not published yet." action={<Button variant="secondary" size="sm" onClick={() => navigate('/')}>Back to home</Button>} />
    </main>
  );
}

export default function StoreApp() {
  const [path, navigate] = usePath();
  const { apps } = useApp();
  const published = apps.filter((a) => a.status === 'published');
  let page: React.ReactNode;
  if (path === '/auth/callback') page = <CallbackPage navigate={navigate} />;
  else if (path.startsWith('/app/')) page = <ResolvedDetailPage pkg={decodeURIComponent(path.slice(5))} navigate={navigate} />;
  else if (path === '/apps') page = <HomePage navigate={navigate} kind="app" />;
  else if (path === '/games') page = <HomePage navigate={navigate} kind="game" />;
  else if (path === '/fdroid') page = <ListPage navigate={navigate} title="F-Droid Open Source" sub="Free and open-source Android apps & games mirrored from F-Droid (f-droid.org)" apps={published.filter(isFdroidApp)} />;
  else if (path === '/charts') page = <ListPage navigate={navigate} title="Top charts" sub={`Most popular on ${APP_NAME}`} apps={[...published].sort((a, b) => b.downloadsCount - a.downloadsCount)} />;
  else if (path.startsWith('/category/')) {
    const slug = path.slice(10);
    page = <ListPage navigate={navigate} title={categoryName(slug)} apps={published.filter((a) => a.category === slug)} />;
  } else if (path.startsWith('/developer/')) {
    const id = path.slice(11);
    const devApps = published.filter((a) => a.developerId === id);
    page = <ListPage navigate={navigate} title={devApps[0]?.developerName ?? 'Developer'} sub="All apps by this developer" apps={devApps} />;
  } else if (path === '/library') page = <LibraryPage navigate={navigate} />;
  else if (path.startsWith('/search')) page = <SearchPage navigate={navigate} query={new URLSearchParams(window.location.search).get('q') ?? ''} />;
  else page = <HomePage navigate={navigate} />;

  return (
    <div className="flex min-h-dvh flex-col bg-[#212121] text-neutral-200">
      <Header navigate={navigate} path={path} />
      <BackendNotice />
      <div className="flex-1">{page}</div>
      <SiteFooter note={`The ${ECOSYSTEM_NAME} ecosystem app store`}>
        <a className="transition hover:text-neutral-200" href={SITE_URLS.console}>Developer Console</a>
        <a className="transition hover:text-neutral-200" href={SITE_URLS.storeapp}>{APP_NAME} for Android</a>
        <span className="flex items-center gap-1.5"><Pill tone="emerald"><ShieldCheck size={11} /> Manually reviewed + F-Droid FOSS</Pill></span>
      </SiteFooter>
      <BottomNav navigate={navigate} path={path} />
    </div>
  );
}
