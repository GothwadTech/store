import { useEffect, useState } from 'react';
import { Bookmark, ChevronRight, Gamepad2, LayoutGrid, Library, Search, UserRound } from 'lucide-react';
import { useApp } from '../lib/AppContext';
import {
  AppCard,
  AppIcon,
  AppRow,
  Avatar,
  Button,
  EmptyState,
  SectionTitle,
  SignInPrompt,
  Skeleton,
  categoryName,
} from '../shared/ui';
import { handleOAuthCallback } from '../lib/auth';
import type { StoreApp as StoreAppType } from '../types';

export function Rail({ apps, onOpen }: { apps: StoreAppType[]; onOpen: (a: StoreAppType) => void }) {
  return (
    <div className="rail no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      {apps.map((a) => (
        <AppCard key={a.id} app={a} onOpen={onOpen} />
      ))}
    </div>
  );
}

function SeeAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-1 flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-emerald-300 transition hover:text-emerald-200"
    >
      See all <ChevronRight size={15} />
    </button>
  );
}

function CategoryChips({ navigate }: { navigate: (p: string) => void }) {
  const { categories } = useApp();
  if (!categories.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      {categories.map((c) => (
        <button
          key={c.slug}
          onClick={() => navigate(`/category/${c.slug}`)}
          className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-neutral-200 transition hover:border-emerald-400/40 hover:bg-white/[0.07] hover:text-white"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-7">
      <Skeleton className="h-64 w-full rounded-3xl sm:h-80" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-5 w-44" />
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[152px] w-[112px] shrink-0 rounded-2xl sm:w-[136px]" />
          ))}
        </div>
      </div>
    </main>
  );
}

export function HomePage({ navigate, kind }: { navigate: (p: string) => void; kind?: 'app' | 'game' }) {
  const { apps, categories, catalogStatus } = useApp();
  const published = apps.filter((a) => a.status === 'published' && (!kind || a.kind === kind));
  const hero = published.filter((a) => a.featured === 'hero');
  const top = [...published].sort((a, b) => b.downloadsCount - a.downloadsCount);
  const rated = [...published].sort((a, b) => b.ratingAvg - a.ratingAvg);
  const fresh = [...published].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = (a: StoreAppType) => navigate(`/app/${a.packageName}`);

  if (catalogStatus === 'loading' && !published.length) return <HomeSkeleton />;
  if (!published.length) {
    const message =
      catalogStatus === 'ready'
        ? `No ${kind === 'game' ? 'games' : kind === 'app' ? 'apps' : 'apps or games'} have been published yet.`
        : 'Store listings are temporarily unavailable.';
    return (
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6">
        <EmptyState
          icon={kind === 'game' ? Gamepad2 : LayoutGrid}
          title={catalogStatus === 'ready' ? 'Nothing published yet' : 'Catalog unavailable'}
          desc={message}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-7">
      {!kind && hero.length > 0 && (
        <section className="mb-9 grid gap-4 lg:grid-cols-5">
          <button
            onClick={() => open(hero[0])}
            aria-label={`Open ${hero[0].name}`}
            className="group relative overflow-hidden rounded-3xl text-left ring-1 ring-white/10 transition hover:ring-white/20 lg:col-span-3"
          >
            <img
              src={hero[0].screenshots[0]}
              alt=""
              className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.04] sm:h-80"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-6">
              <AppIcon app={hero[0]} size={72} />
              <span className="min-w-0">
                <span className="mb-1.5 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#08130e]">
                  Featured
                </span>
                <span className="block font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {hero[0].name}
                </span>
                <span className="line-clamp-2 block max-w-md text-sm leading-relaxed text-neutral-300">
                  {hero[0].shortDesc}
                </span>
              </span>
            </span>
          </button>
          <div className="rounded-3xl border border-white/[0.08] bg-[#262626]/70 p-4 lg:col-span-2">
            <SectionTitle
              title="Top charts"
              sub="Most downloaded apps and games"
              action={<SeeAll onClick={() => navigate('/charts')} />}
            />
            <div className="-mx-1">
              {top.slice(0, 4).map((a, i) => (
                <AppRow key={a.id} app={a} rank={i + 1} onOpen={open} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mb-9">
        <SectionTitle
          title={kind === 'game' ? 'Suggested games' : kind === 'app' ? 'Suggested apps' : 'Suggested for you'}
          action={!kind ? <SeeAll onClick={() => navigate('/apps')} /> : undefined}
        />
        <Rail apps={published} onOpen={open} />
      </section>

      {categories.length > 0 && (
        <section className="mb-9">
          <SectionTitle title="Categories" sub="Browse by what you need" />
          <CategoryChips navigate={navigate} />
        </section>
      )}

      <section className="mb-9">
        <SectionTitle title="Top rated" sub="Highest rated by users" />
        <Rail apps={rated} onOpen={open} />
      </section>

      <section>
        <SectionTitle title="New & updated" sub="Recently published or updated" />
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {fresh.slice(0, 6).map((a) => (
            <AppRow key={a.id} app={a} onOpen={open} />
          ))}
        </div>
      </section>
    </main>
  );
}

export function ListPage({
  navigate,
  title,
  apps,
  sub,
}: {
  navigate: (p: string) => void;
  title: string;
  apps: StoreAppType[];
  sub?: string;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-neutral-400">{sub}</p>}
      {apps.length ? (
        <div className="mt-5 grid gap-1 sm:grid-cols-2">
          {apps.map((a, i) => (
            <AppRow key={a.id} app={a} rank={i + 1} onOpen={(x) => navigate(`/app/${x.packageName}`)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="Nothing here yet"
          desc="Once apps are published and reviewed, they will show up on this page."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
              Back to home
            </Button>
          }
        />
      )}
    </main>
  );
}

export function SearchPage({ navigate, query }: { navigate: (p: string) => void; query: string }) {
  const { apps } = useApp();
  const q = query.toLowerCase();
  const results = apps.filter(
    (a) =>
      a.status === 'published' &&
      (!q ||
        a.name.toLowerCase().includes(q) ||
        a.developerName.toLowerCase().includes(q) ||
        categoryName(a.category).toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))),
  );
  return (
    <ListPage
      navigate={navigate}
      title={q ? `Results for "${query}"` : 'Search'}
      sub={`${results.length} ${results.length === 1 ? 'app' : 'apps'} found`}
      apps={results}
    />
  );
}

export function LibraryPage({ navigate }: { navigate: (p: string) => void }) {
  const { user, apps, library, wishlist, authReady } = useApp();
  if (!authReady) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-neutral-400">
        Checking your Gothwad Account…
      </main>
    );
  }
  if (!user) return <SignInPrompt what="Store Library" />;
  const lib = apps.filter((a) => library.includes(a.id));
  const wish = apps.filter((a) => wishlist.includes(a.id));
  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} size={52} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-white">
            Welcome, {user.name} 👋
          </h1>
          <p className="truncate text-sm text-neutral-400">
            @{user.username} · {user.email}
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#262626]/70 p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">Downloads</p>
          <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">{lib.length}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#262626]/70 p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">Wishlist</p>
          <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">{wish.length}</p>
        </div>
      </div>

      <div className="mt-9">
        <SectionTitle title="My library" sub="Apps you have downloaded" />
        {lib.length ? (
          <div className="grid gap-1 sm:grid-cols-2">
            {lib.map((a) => (
              <AppRow key={a.id} app={a} onOpen={(x) => navigate(`/app/${x.packageName}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Library}
            title="Your library is empty"
            desc="Download an app and it will show up here on every device you sign in on."
          />
        )}
      </div>

      <div className="mt-9">
        <SectionTitle title="Wishlist" sub="Saved for later" />
        {wish.length ? (
          <div className="grid gap-1 sm:grid-cols-2">
            {wish.map((a) => (
              <AppRow key={a.id} app={a} onOpen={(x) => navigate(`/app/${x.packageName}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Bookmark}
            title="Nothing saved yet"
            desc="Tap the bookmark button on any app page to keep it here."
          />
        )}
      </div>
    </main>
  );
}

export function CallbackPage({ navigate }: { navigate: (p: string) => void }) {
  const { setUser } = useApp();
  const [msg, setMsg] = useState('Returning from Gothwad Accounts...');
  useEffect(() => {
    handleOAuthCallback().then((r) => {
      if ('user' in r) {
        setUser(r.user);
        setMsg('Signed in! Taking you to the Store...');
        setTimeout(() => navigate('/'), 700);
      } else {
        setMsg(`We could not sign you in (${r.error}). Go back and try again.`);
      }
    });
  }, [navigate, setUser]);
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-300">
        <UserRound size={22} />
      </span>
      <p className="mt-4 text-neutral-300">{msg}</p>
    </main>
  );
}
