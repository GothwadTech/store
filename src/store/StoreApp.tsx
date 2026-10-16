import { useMemo, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Bookmark, BookmarkCheck, ChevronRight, Download, Flag,
  Gamepad2, Home, LayoutGrid, Library, Search, ShieldCheck, Star, Trophy, X,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { usePath } from '../lib/router';
import { categoryName, AppCard, AppIcon, AppRow, Logo, SectionTitle, SignInPrompt, Stars } from '../shared/ui';
import { formatBytes, formatCount } from '../lib/storage';
import { handleOAuthCallback } from '../lib/auth';
import type { StoreApp as StoreAppType } from '../types';
import { useEffect } from 'react';

function Header({ navigate, path }: { navigate: (p: string) => void; path: string }) {
  const { user, signInDemo, signOut } = useApp();
  const [q, setQ] = useState('');
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#212121]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-5">
        <button onClick={() => navigate('/')} aria-label="Gothwad Store home"><Logo subtitle="Store" /></button>
        <form
          className="mx-auto hidden w-full max-w-xl items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 ring-1 ring-white/[0.06] focus-within:ring-emerald-400/50 md:flex"
          onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); }}
        >
          <Search size={17} className="shrink-0 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps & games" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear"><X size={15} className="text-neutral-400" /></button>}
        </form>
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {[['/', 'For you', Home], ['/apps', 'Apps', LayoutGrid], ['/games', 'Games', Gamepad2], ['/charts', 'Top charts', Trophy], ['/library', 'Library', Library]].map(([to, label, Icon]) => (
            <button key={to as string} onClick={() => navigate(to as string)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${path === to ? 'bg-emerald-500/15 text-emerald-300' : 'text-neutral-300 hover:bg-white/5 hover:text-white'}`}>
              {label as string}
            </button>
          ))}
        </nav>
        {user ? (
          <button onClick={signOut} title={`${user.name} - sign out`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 font-display text-sm font-bold text-white">
            {user.name.charAt(0)}
          </button>
        ) : (
          <button onClick={signInDemo} className="shrink-0 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400">Sign in</button>
        )}
      </div>
      <form className="px-4 pb-3 md:hidden" onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); }}>
        <label className="flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 ring-1 ring-white/[0.06]">
          <Search size={16} className="text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps & games" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" />
        </label>
      </form>
    </header>
  );
}

function Rail({ apps, onOpen }: { apps: StoreAppType[]; onOpen: (a: StoreAppType) => void }) {
  return <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">{apps.map((a) => <AppCard key={a.id} app={a} onOpen={onOpen} />)}</div>;
}

function CategoryChips({ navigate }: { navigate: (p: string) => void }) {
  const { categories } = useApp();
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {categories.map((c) => (
        <button key={c.slug} onClick={() => navigate(`/category/${c.slug}`)} className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-neutral-200 transition hover:border-emerald-400/40 hover:text-white">
          {c.name}
        </button>
      ))}
    </div>
  );
}

function HomePage({ navigate, kind }: { navigate: (p: string) => void; kind?: 'app' | 'game' }) {
  const { apps } = useApp();
  const published = apps.filter((a) => a.status === 'published' && (!kind || a.kind === kind));
  const hero = published.filter((a) => a.featured === 'hero');
  const top = [...published].sort((a, b) => b.downloadsCount - a.downloadsCount);
  const rated = [...published].sort((a, b) => b.ratingAvg - a.ratingAvg);
  const fresh = [...published].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = (a: StoreAppType) => navigate(`/app/${a.packageName}`);
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:pt-7">
      {!kind && hero.length > 0 && (
        <section className="mb-8 grid gap-4 lg:grid-cols-5">
          <button onClick={() => open(hero[0])} className="group relative overflow-hidden rounded-3xl text-left ring-1 ring-white/10 lg:col-span-3">
            <img src={hero[0].screenshots[0]} alt="" className="h-64 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-80" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            <span className="absolute bottom-0 flex items-end gap-4 p-5">
              <AppIcon app={hero[0]} size={72} />
              <span>
                <span className="mb-1 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Featured</span>
                <span className="block font-display text-2xl font-bold text-white">{hero[0].name}</span>
                <span className="line-clamp-1 block max-w-md text-sm text-neutral-300">{hero[0].shortDesc}</span>
              </span>
            </span>
          </button>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-4 lg:col-span-2">
            <SectionTitle title="Top charts" sub="Most downloaded apps and games" />
            {top.slice(0, 4).map((a, i) => <AppRow key={a.id} app={a} rank={i + 1} onOpen={open} />)}
            <button onClick={() => navigate('/charts')} className="mt-2 flex items-center gap-1 px-3 text-sm font-semibold text-emerald-300">See all <ChevronRight size={15} /></button>
          </div>
        </section>
      )}
      <section className="mb-8"><SectionTitle title={kind === 'game' ? 'Suggested games' : kind === 'app' ? 'Suggested apps' : 'Suggested for you'} /><Rail apps={published} onOpen={open} /></section>
      <section className="mb-8"><SectionTitle title="Categories" /><CategoryChips navigate={navigate} /></section>
      <section className="mb-8"><SectionTitle title="Top rated" sub="Highest rated by users" /><Rail apps={rated} onOpen={open} /></section>
      <section><SectionTitle title="New & updated" /><div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{fresh.slice(0, 6).map((a) => <AppRow key={a.id} app={a} onOpen={open} />)}</div></section>
    </main>
  );
}

function ListPage({ navigate, title, apps, sub }: { navigate: (p: string) => void; title: string; apps: StoreAppType[]; sub?: string }) {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
      <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1 text-sm text-neutral-400">{sub}</p>}
      <div className="mt-5 grid gap-1 sm:grid-cols-2">
        {apps.map((a, i) => <AppRow key={a.id} app={a} rank={i + 1} onOpen={(x) => navigate(`/app/${x.packageName}`)} />)}
      </div>
      {!apps.length && <p className="py-16 text-center text-neutral-500">Nothing here yet.</p>}
    </main>
  );
}

function SearchPage({ navigate, query }: { navigate: (p: string) => void; query: string }) {
  const { apps } = useApp();
  const q = query.toLowerCase();
  const results = apps.filter((a) => a.status === 'published' && (!q || a.name.toLowerCase().includes(q) || a.developerName.toLowerCase().includes(q) || categoryName(a.category).toLowerCase().includes(q) || a.tags.some((t) => t.includes(q))));
  return <ListPage navigate={navigate} title={q ? `Results for "${query}"` : 'Search'} sub={`${results.length} apps found`} apps={results} />;
}

function DetailPage({ app, navigate }: { app: StoreAppType; navigate: (p: string) => void }) {
  const ctx = useApp();
  const { user, reviews, wishlist, toggleWishlist, recordDownload, liveReleaseOf, addReview, signInDemo, reportApp, backendLive } = ctx;
  const rel = liveReleaseOf(app.id);
  const appReviews = reviews.filter((r) => r.appId === app.id);
  const wished = wishlist.includes(app.id);
  const [progress, setProgress] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [toast, setToast] = useState('');
  const similar = ctx.apps.filter((a) => a.status === 'published' && a.id !== app.id && a.category === app.category);

  const download = () => {
    if (progress !== null) return;
    setProgress(0);
    const t = setInterval(() => {
      setProgress((p) => {
        if (p === null || p >= 100) {
          clearInterval(t);
          void recordDownload(app);
          // Live mode me apkUrl = /api/download/:releaseId (Worker count karke asal file par bhejta hai).
          if (backendLive && rel?.apkUrl) window.open(rel.apkUrl, '_blank', 'noopener');
          setToast('Download started. Open the APK to install it.');
          return 100;
        }
        return p + 20;
      });
    }, 180);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-5">
      <button onClick={() => navigate('/')} className="mb-5 flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white"><ArrowLeft size={16} /> Back</button>
      <div className="flex flex-wrap items-start gap-5">
        <AppIcon app={app} size={104} rounded="rounded-[26px]" />
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-3xl font-bold text-white">{app.name}</h1>
          <button onClick={() => navigate(`/developer/${app.developerId}`)} className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-300 hover:underline">
            {app.developerName} {app.developerVerified && <BadgeCheck size={15} className="fill-emerald-400 text-[#212121]" />}
          </button>
          <p className="mt-0.5 text-[13px] text-neutral-400">{categoryName(app.category)} · Ads-free · Gothwad Store verified</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-center">
            <span><b className="flex items-center gap-1 text-sm text-white">{app.ratingAvg.toFixed(1)} <Star size={13} className="fill-white" /></b><i className="block text-[11px] not-italic text-neutral-500">{formatCount(app.ratingCount)} reviews</i></span>
            <span><b className="text-sm text-white">{formatCount(app.downloadsCount)}</b><i className="block text-[11px] not-italic text-neutral-500">Downloads</i></span>
            <span><b className="text-sm text-white">{rel ? formatBytes(rel.apkSizeBytes) : '-'}</b><i className="block text-[11px] not-italic text-neutral-500">Size</i></span>
            <span><b className="text-sm text-white">{rel ? `v${rel.versionName}` : '-'}</b><i className="block text-[11px] not-italic text-neutral-500">Version</i></span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={download} className="min-w-52 flex-1 rounded-full bg-emerald-500 px-8 py-3.5 font-display font-bold text-white shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400 sm:flex-none sm:px-14">
          {progress === null ? <span className="flex items-center justify-center gap-2"><Download size={19} /> Install</span> : progress >= 100 ? 'Downloaded' : `Downloading ${progress}%`}
        </button>
        <button onClick={() => (user ? toggleWishlist(app.id) : signInDemo())} className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-sm font-semibold text-neutral-100 hover:bg-white/5">
          {wished ? <BookmarkCheck size={18} className="text-emerald-300" /> : <Bookmark size={18} />} {wished ? 'Wishlisted' : 'Wishlist'}
        </button>
      </div>
      {toast && <p className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 ring-1 ring-emerald-400/20">{toast}</p>}

      {app.screenshots.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-8 flex gap-3 overflow-x-auto px-4">
          {app.screenshots.map((s, i) => <img key={i} src={s} alt={`${app.name} screenshot ${i + 1}`} className="h-80 w-44 shrink-0 rounded-2xl object-cover ring-1 ring-white/10" loading="lazy" />)}
        </div>
      )}

      <section className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">About this {app.kind === 'game' ? 'game' : 'app'}</h2>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-300">{app.fullDesc || app.shortDesc}</p>
          {rel?.changelog && <><h3 className="mt-6 font-display font-bold text-white">What's new</h3><p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{rel.changelog}</p></>}
          <h3 className="mt-7 flex items-center gap-2 font-display font-bold text-white"><ShieldCheck size={18} className="text-emerald-300" /> Data safety & permissions</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-neutral-400">
            {(rel?.permissions.length ? rel.permissions : ['android.permission.INTERNET']).map((p) => <li key={p} className="rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-xs">{p}</li>)}
          </ul>
          {rel?.apkSha256 && <p className="mt-2 break-all font-mono text-[11px] text-neutral-600">SHA-256: {rel.apkSha256}</p>}
          {user && <button onClick={() => { void reportApp(app, 'Other', '').then(() => setToast('Report submitted. Our team will review it. Thank you.')).catch((err: Error) => setToast(err.message)); }} className="mt-6 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-red-300"><Flag size={13} /> Report this app</button>}
        </div>
        <aside className="h-fit rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5">
          <h3 className="font-display font-bold text-white">Developer</h3>
          <button onClick={() => navigate(`/developer/${app.developerId}`)} className="mt-1 text-sm text-emerald-300 hover:underline">{app.developerName}</button>
          <dl className="mt-3 space-y-2 text-[13px] text-neutral-400">
            <div className="flex justify-between"><dt>Support</dt><dd className="text-neutral-200">{app.supportEmail}</dd></div>
            {app.website && <div className="flex justify-between gap-3"><dt>Website</dt><dd className="truncate text-neutral-200">{app.website}</dd></div>}
            <div className="flex justify-between"><dt>Updated</dt><dd className="text-neutral-200">{new Date(app.updatedAt).toLocaleDateString('en-IN')}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-white">Ratings & reviews</h2>
        <div className="mt-4 grid gap-8 md:grid-cols-[180px_1fr]">
          <div className="text-center md:text-left">
            <p className="font-display text-5xl font-bold text-white">{app.ratingAvg.toFixed(1)}</p>
            <Stars value={app.ratingAvg} size={16} />
            <p className="mt-1 text-xs text-neutral-500">{formatCount(app.ratingCount)} verified ratings</p>
          </div>
          <div>
            {user ? (
              <form className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4" onSubmit={(e) => { e.preventDefault(); void addReview(app.id, rating, body).then(() => setBody('')).catch((err: Error) => setToast(err.message)); }}>
                <p className="text-sm font-semibold text-white">Write your review, @{user.username}</p>
                <div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} star`}><Star size={24} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-600'} /></button>)}</div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} placeholder="What did you think of this app?" className="mt-3 w-full rounded-xl bg-black/25 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-neutral-500 focus:ring-emerald-400/50" />
                <button className="mt-3 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400">Post review</button>
              </form>
            ) : (
              <button onClick={signInDemo} className="mb-6 w-full rounded-2xl border border-dashed border-white/15 px-4 py-4 text-sm text-neutral-300 hover:bg-white/[0.03]">Sign in with Gothwad to write a review</button>
            )}
            <div className="space-y-4">
              {appReviews.map((r) => (
                <article key={r.id} className="border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-neutral-700 font-display text-xs font-bold text-white">{r.username.charAt(0).toUpperCase()}</span>
                    <b className="text-sm text-white">@{r.username}</b><Stars value={r.rating} size={11} />
                    <span className="ml-auto text-[11px] text-neutral-600">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-300">{r.body}</p>
                  {r.developerReply && <div className="mt-2.5 rounded-xl bg-white/[0.04] p-3 text-[13px] text-neutral-300"><b className="text-emerald-300">{app.developerName} (developer): </b>{r.developerReply}</div>}
                </article>
              ))}
              {!appReviews.length && <p className="text-sm text-neutral-500">No reviews yet. Be the first to write one.</p>}
            </div>
          </div>
        </div>
      </section>

      {similar.length > 0 && <section className="mt-12"><SectionTitle title="Similar apps" /><Rail apps={similar} onOpen={(a) => navigate(`/app/${a.packageName}`)} /></section>}
    </main>
  );
}

function LibraryPage({ navigate }: { navigate: (p: string) => void }) {
  const { user, apps, library, wishlist, signInDemo } = useApp();
  if (!user) return <SignInPrompt onDemo={signInDemo} what="Store Library" />;
  const lib = apps.filter((a) => library.includes(a.id));
  const wish = apps.filter((a) => wishlist.includes(a.id));
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
      <h1 className="font-display text-2xl font-bold text-white">Welcome, {user.name} 👋</h1>
      <p className="mt-1 text-sm text-neutral-400">@{user.username} · {user.email}</p>
      <SectionTitle title="My library" sub="Apps you have downloaded" />
      <div className="grid gap-1 sm:grid-cols-2">{lib.map((a) => <AppRow key={a.id} app={a} onOpen={(x) => navigate(`/app/${x.packageName}`)} />)}</div>
      {!lib.length && <p className="mb-8 text-sm text-neutral-500">Your library is empty. Download an app to see it here.</p>}
      <div className="mt-8"><SectionTitle title="Wishlist" /></div>
      <div className="grid gap-1 sm:grid-cols-2">{wish.map((a) => <AppRow key={a.id} app={a} onOpen={(x) => navigate(`/app/${x.packageName}`)} />)}</div>
      {!wish.length && <p className="text-sm text-neutral-500">Your wishlist is empty.</p>}
    </main>
  );
}

function CallbackPage({ navigate }: { navigate: (p: string) => void }) {
  const { setUser } = useApp();
  const [msg, setMsg] = useState('Returning from Gothwad Accounts...');
  useEffect(() => {
    handleOAuthCallback().then((r) => {
      if ('user' in r) { setUser(r.user); setMsg('Signed in! Taking you to the Store...'); setTimeout(() => navigate('/'), 700); }
      else setMsg(`We could not sign you in (${r.error}). Go back and try again.`);
    });
  }, [navigate, setUser]);
  return <main className="mx-auto max-w-md px-4 py-24 text-center"><p className="text-neutral-300">{msg}</p></main>;
}

export default function StoreApp() {
  const [path, navigate] = usePath();
  const { apps } = useApp();
  const published = apps.filter((a) => a.status === 'published');
  let page: React.ReactNode;
  if (path === '/auth/callback') page = <CallbackPage navigate={navigate} />;
  else if (path.startsWith('/app/')) {
    const pkg = decodeURIComponent(path.slice(5));
    const app = apps.find((a) => a.packageName === pkg && a.status === 'published');
    page = app ? <DetailPage app={app} navigate={navigate} /> : <main className="py-24 text-center text-neutral-400">This app was not found, or it is not published yet.</main>;
  } else if (path === '/apps') page = <HomePage navigate={navigate} kind="app" />;
  else if (path === '/games') page = <HomePage navigate={navigate} kind="game" />;
  else if (path === '/charts') page = <ListPage navigate={navigate} title="Top charts" sub="Most popular on Gothwad Store" apps={[...published].sort((a, b) => b.downloadsCount - a.downloadsCount)} />;
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

  const tabs: [string, string, typeof Home][] = [['/', 'For you', Home], ['/apps', 'Apps', LayoutGrid], ['/games', 'Games', Gamepad2], ['/search', 'Search', Search], ['/library', 'Library', Library]];
  return (
    <div className="min-h-dvh bg-[#212121] text-neutral-200">
      <Header navigate={navigate} path={path} />
      {page}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/[0.07] bg-[#212121]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {tabs.map(([to, label, Icon]) => (
          <button key={to} onClick={() => navigate(to)} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${path === to ? 'text-emerald-300' : 'text-neutral-500'}`}>
            <Icon size={20} />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
