import { useState } from 'react';
import {
  BarChart3, CheckCircle2, ChevronRight, CircleAlert, Download, FileUp, HelpCircle,
  LayoutDashboard, LoaderCircle, Menu, MessageSquareText, PackagePlus, Plus, Settings, Smartphone, Star,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { usePath } from '../lib/router';
import {
  AccountMenu, AppIcon, Avatar, Card, EmptyState, Logo, PageHeader, Sheet, StatCard,
  StatusBadge, btnGhost, btnPrimary, categoryName, cx,
} from '../shared/ui';
import { BackendNotice } from '../shared/BackendNotice';
import { formatCount } from '../lib/storage';
import { APP_NAME, APP_SHORT_NAME, SITE_HOSTS } from '../lib/config';

export const inputCls = 'w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15';
export const labelCls = 'mb-1.5 block text-[13px] font-medium text-neutral-300';
export const hintCls = 'mt-1 text-xs leading-relaxed text-neutral-500';

type NavItem = [string, string, typeof LayoutDashboard];

function ConsoleNav({ groups, isActive, navigate, onNavigate, layout }: {
  groups: { heading: string; items: NavItem[] }[];
  isActive: (to: string) => boolean;
  navigate: (p: string) => void;
  onNavigate?: () => void;
  layout: 'sidebar' | 'drawer';
}) {
  const drawer = layout === 'drawer';
  return (
    <nav className={cx('px-3 py-3', drawer ? 'space-y-4' : 'no-scrollbar flex gap-1 overflow-x-auto lg:block lg:flex-1 lg:space-y-5 lg:overflow-y-auto lg:py-4')} aria-label="Console sections">
      {groups.map((g) => (
        <div key={g.heading} className={cx(drawer ? 'block' : 'flex gap-1 lg:block')}>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{g.heading}</p>
          {g.items.map(([to, label, Icon]) => (
            <button key={to} onClick={() => { navigate(to); onNavigate?.(); }} aria-current={isActive(to) ? 'page' : undefined}
              className={cx('mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition',
                drawer ? 'w-full' : 'shrink-0 lg:w-full',
                isActive(to) ? 'bg-emerald-500/15 font-semibold text-emerald-200' : 'text-neutral-300 hover:bg-white/[0.05] hover:text-white')}>
              <Icon size={17} className={isActive(to) ? 'text-emerald-300' : 'text-neutral-500'} /> {label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

const CRUMB_LABELS: [string, string][] = [
  ['/apps/new', 'Create app'],
  ['/stats', 'Statistics'],
  ['/reviews', 'Reviews'],
  ['/settings', 'Developer profile'],
  ['/onboarding', 'Get started'],
];

export function Shell({ children, navigate, path }: { children: React.ReactNode; navigate: (p: string) => void; path: string }) {
  const { user, developer } = useApp();
  const [drawer, setDrawer] = useState(false);
  const groups: { heading: string; items: NavItem[] }[] = [
    { heading: 'Overview', items: [['/', 'Dashboard', LayoutDashboard], ['/apps/new', 'Create app', PackagePlus]] },
    { heading: 'Insights', items: [['/stats', 'Statistics', BarChart3], ['/reviews', 'Reviews', MessageSquareText]] },
    { heading: 'Account', items: [['/settings', 'Developer profile', Settings]] },
  ];
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  const crumb = path === '/' ? 'Dashboard'
    : path.startsWith('/apps/') && path !== '/apps/new' ? 'App'
      : CRUMB_LABELS.find(([to]) => path.startsWith(to))?.[1] ?? 'Console';

  const developerCard = developer && (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#242424] px-3.5 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 font-display text-sm font-bold text-[#08130e]">
        {(developer.orgName || developer.displayName).charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-white">{developer.orgName || developer.displayName}</span>
        <span className="block truncate text-xs text-neutral-500">@{developer.username}</span>
      </span>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[#212121] text-neutral-200 lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-[268px] shrink-0 flex-col border-r border-white/[0.07] bg-[#1b1b1b] lg:flex">
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5"><Logo subtitle="Developer Console" /></div>
        {developerCard}
        <ConsoleNav groups={groups} isActive={isActive} navigate={navigate} layout="sidebar" />
        <div className="border-t border-white/[0.06] p-4">
          <div className="rounded-xl bg-[#242424] p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-white"><HelpCircle size={15} className="text-emerald-300" /> Publishing guide</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">Listing requirements, review policy, and APK upload rules (GitHub storefiles, up to 50 MB).</p>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-white/[0.07] bg-[#1b1b1b]/95 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setDrawer(true)} className="rounded-lg p-2 text-neutral-300 transition hover:bg-white/5 hover:text-white" aria-label="Open console menu">
          <Menu size={20} />
        </button>
        <Logo subtitle="Console" />
        <div className="ml-auto">{user ? <AccountMenu size={34} /> : <Avatar name="?" size={34} />}</div>
      </div>
      <Sheet open={drawer} onClose={() => setDrawer(false)} title="Console menu">
        {developerCard}
        <ConsoleNav groups={groups} isActive={isActive} navigate={navigate} onNavigate={() => setDrawer(false)} layout="drawer" />
        <div className="border-t border-white/[0.06] p-4">
          <p className="text-xs leading-relaxed text-neutral-500">Listing requirements, review policy, and APK upload rules (GitHub storefiles, up to 50 MB).</p>
        </div>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-16 items-center gap-3 border-b border-white/[0.07] bg-[#212121]/95 px-6 backdrop-blur lg:flex">
          <p className="flex items-center gap-1.5 text-sm text-neutral-500">
            Console <ChevronRight size={14} className="text-neutral-700" />
            <span className="font-medium text-neutral-200">{crumb}</span>
          </p>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2.5 xl:flex">
              <span className="max-w-[190px] leading-tight">
                <span className="block truncate text-[13px] font-medium text-white">{user?.name}</span>
                <span className="block truncate text-[11px] text-neutral-500">{user?.email}</span>
              </span>
            </span>
            <span className="h-6 w-px bg-white/10" />
            <AccountMenu size={36} />
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <BackendNotice />
          {children}
        </div>
        <footer className="border-t border-white/[0.06] px-4 py-4 text-xs text-neutral-600 sm:px-6">{APP_SHORT_NAME} Developer Console · {SITE_HOSTS.console}</footer>
      </div>
    </div>
  );
}

export function Onboarding() {
  const { user, registerDeveloper } = useApp();
  const [, navigate] = usePath();
  const [form, setForm] = useState({ displayName: user?.name ?? '', orgName: '', supportEmail: user?.email ?? '', website: '' });
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-0">
        {['Gothwad Account', 'Developer profile', 'Create your first app'].map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <span className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold ${i < 2 ? 'bg-emerald-600 text-white' : 'border border-white/15 text-neutral-400'}`}>{i < 1 ? '✓' : i + 1}</span>
              <span className={`hidden text-[13px] font-medium sm:block ${i === 1 ? 'text-white' : 'text-neutral-500'}`}>{s}</span>
            </span>
            {i < 2 && <span className="mx-3 h-px flex-1 bg-white/12" />}
          </div>
        ))}
      </div>
      <Card title="Create your developer profile" desc="This is shown publicly on your app listings. You only need to do this once — there is no registration fee.">
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (saving) return; setSaving(true); setError(''); void registerDeveloper(form).then(() => navigate('/')).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Developer profile could not be created.')).finally(() => setSaving(false)); }}>
          {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3.5 py-3 text-sm text-red-200">{error}</p>}
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className={labelCls}>Your name</label><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputCls} placeholder="Jane Doe" /></div>
            <div><label className={labelCls}>Developer / organization name</label><input required value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} className={inputCls} placeholder="Acme Studios" /><p className={hintCls}>Shown as the publisher name on the store.</p></div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className={labelCls}>Support email</label><input required type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className={inputCls} /><p className={hintCls}>Public. Users contact you here for support.</p></div>
            <div><label className={labelCls}>Website (optional)</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} placeholder="https://example.com" /></div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.08] bg-[#242424] px-3.5 py-3 text-[13px] leading-relaxed text-neutral-300">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-emerald-500" />
            I agree to the {APP_NAME} Developer Policy. I confirm that my apps are my own work, are not pirated or modified versions of paid apps, and do not collect user data without disclosure.
          </label>
          <div className="flex justify-end gap-2.5 border-t border-white/[0.06] pt-4">
            <button disabled={!agree || saving} className={btnPrimary}>{saving ? <><LoaderCircle size={16} className="animate-spin" /> Creating profile…</> : 'Create developer profile'}</button>
          </div>
        </form>
      </Card>
    </main>
  );
}

export function Dashboard({ navigate }: { navigate: (p: string) => void }) {
  const { apps, developer, submissions, liveReleaseOf } = useApp();
  const mine = apps.filter((a) => a.developerId === developer?.id);
  const totalDownloads = mine.reduce((t, a) => t + a.downloadsCount, 0);
  const avgRating = mine.filter((a) => a.ratingCount).length
    ? mine.reduce((t, a) => t + a.ratingAvg, 0) / mine.filter((a) => a.ratingCount).length : 0;
  const rejected = submissions.find((s) => s.status === 'rejected' && mine.some((a) => a.id === s.appId));
  return (
    <main>
      <PageHeader title="Dashboard" desc="Manage your apps, releases, and store presence.">
        <button onClick={() => navigate('/apps/new')} className={btnPrimary}><Plus size={16} /> Create app</button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard label="Total apps" value={String(mine.length)} sub={`${mine.filter((a) => a.status === 'published').length} published`} icon={Smartphone} />
        <StatCard label="Total downloads" value={formatCount(totalDownloads)} sub="All time, all apps" icon={Download} />
        <StatCard label="Average rating" value={avgRating ? avgRating.toFixed(1) : '—'} sub="Across rated apps" icon={Star} />
        <StatCard label="Pending reviews" value={String(submissions.filter((s) => s.status === 'pending' && mine.some((a) => a.id === s.appId)).length)} sub="Waiting for admin approval" icon={FileUp} />
      </div>

      {rejected && (
        <p className="mb-5 flex gap-2.5 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <span>A submission for <b>{rejected.appName}</b> was rejected. Open the app to read the reviewer note, fix the issue, and resubmit.</span>
        </p>
      )}

      <Card title="Your apps" desc={mine.length ? `${mine.length} app${mine.length > 1 ? 's' : ''} on this developer profile` : undefined}>
        {mine.length ? (
          <>
            <div className="-mx-5 -my-2 divide-y divide-white/[0.06] md:hidden">
              {mine.map((a) => { const live = liveReleaseOf(a.id); return (
                <button key={a.id} onClick={() => navigate(`/apps/${a.id}`)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]">
                  <AppIcon app={a} size={44} rounded="rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{a.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                      <span>{live ? `v${live.versionName}` : 'No release'}</span><span aria-hidden="true">·</span>
                      <span>{formatCount(a.downloadsCount)} downloads</span><span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1"><Star size={11} /> {a.ratingCount ? a.ratingAvg.toFixed(1) : '—'}</span>
                    </span>
                    <span className="mt-1.5 block"><StatusBadge status={a.status} /></span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-neutral-600" />
                </button>
              );})}
            </div>
            <div className="-mx-5 -my-2 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-5 py-2.5 font-semibold">App</th><th className="px-3 py-2.5 font-semibold">Category</th>
                    <th className="px-3 py-2.5 font-semibold">Live version</th><th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Downloads</th><th className="px-3 py-2.5 text-right font-semibold">Rating</th><th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {mine.map((a) => { const live = liveReleaseOf(a.id); return (
                    <tr key={a.id} onClick={() => navigate(`/apps/${a.id}`)} className="cursor-pointer border-b border-white/[0.05] transition last:border-0 hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3"><AppIcon app={a} size={40} rounded="rounded-[10px]" />
                          <span className="min-w-0"><span className="block max-w-[260px] truncate font-medium text-white">{a.name}</span>
                          <span className="block truncate text-xs text-neutral-500">{a.packageName}</span></span></span>
                      </td>
                      <td className="px-3 py-3 text-neutral-400">{categoryName(a.category)}</td>
                      <td className="px-3 py-3 text-neutral-400">{live ? `v${live.versionName}` : '—'}</td>
                      <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-3 py-3 text-right text-neutral-300">{formatCount(a.downloadsCount)}</td>
                      <td className="px-3 py-3 text-right text-neutral-300">{a.ratingCount ? a.ratingAvg.toFixed(1) : '—'}</td>
                      <td className="px-3 py-3"><ChevronRight size={16} className="text-neutral-600" /></td>
                    </tr>);})}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState icon={Smartphone} title="No apps yet"
            desc="Create your first app listing, upload an APK, and submit it for review. Every release is reviewed before it goes live."
            action={<button onClick={() => navigate('/apps/new')} className={btnPrimary}><Plus size={16} /> Create app</button>} />
        )}
      </Card>
    </main>
  );
}

export function CreateApp({ navigate }: { navigate: (p: string) => void }) {
  const { createApp, categories, apps } = useApp();
  const [name, setName] = useState('');
  const [pkg, setPkg] = useState('');
  const [category, setCategory] = useState('tools');
  const [kind, setKind] = useState<'app' | 'game'>('app');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const validPkg = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg);
  const taken = apps.some((a) => a.packageName === pkg);
  const availableCategories = categories.filter((c) => (kind === 'game' ? c.kind !== 'app' : c.kind !== 'game'));

  const changeKind = (nextKind: 'app' | 'game') => {
    setKind(nextKind);
    const nextCategories = categories.filter((c) => (nextKind === 'game' ? c.kind !== 'app' : c.kind !== 'game'));
    if (!nextCategories.some((item) => item.slug === category)) setCategory(nextCategories[0]?.slug ?? 'tools');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (creating || !validPkg || taken || !name.trim()) return;
    setCreating(true);
    setError('');
    void createApp({ name: name.trim(), packageName: pkg, category, kind })
      .then((created) => navigate(`/apps/${created.id}`))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'We could not create this app. Please try again.'))
      .finally(() => setCreating(false));
  };

  return (
    <main>
      <PageHeader title="Create app" desc="Set the permanent identity first. We will guide you through the listing, artwork, APK upload, and review after this step." />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <form className="space-y-5" onSubmit={submit} noValidate>
            {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3.5 py-3 text-sm text-red-200"><b>Could not create app:</b> {error}</p>}
            <div><label className={labelCls}>App name</label><input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="My Awesome App" autoFocus /></div>
            <div>
              <label className={labelCls}>Package name</label>
              <input required spellCheck={false} autoCapitalize="none" value={pkg} onChange={(e) => setPkg(e.target.value.trim().toLowerCase())} className={inputCls} placeholder="com.company.appname" aria-describedby="package-help" />
              <div id="package-help" aria-live="polite">
                {pkg && (taken
                  ? <p className="mt-1.5 text-xs font-medium text-red-300">This package name is already taken.</p>
                  : validPkg
                    ? <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-300"><CheckCircle2 size={13} /> Package name is valid and available.</p>
                    : <p className="mt-1.5 text-xs text-amber-300">Use lowercase letters with at least one dot, e.g. com.company.app.</p>)}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={labelCls}>Type</label><select value={kind} onChange={(e) => changeKind(e.target.value as 'app' | 'game')} className={inputCls}><option value="app">App</option><option value="game">Game</option></select></div>
              <div><label className={labelCls}>Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>{availableCategories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2.5 border-t border-white/[0.06] pt-4">
              <button type="button" disabled={creating} onClick={() => navigate('/')} className={btnGhost}>Cancel</button>
              <button disabled={creating || !validPkg || taken || !name.trim()} className={btnPrimary}>
                {creating ? <><LoaderCircle size={16} className="animate-spin" /> Creating app…</> : <>Create app <ChevronRight size={16} /></>}
              </button>
            </div>
          </form>
        </Card>
        <Card title="What happens next" desc="No APK is uploaded on this screen.">
          <ol className="space-y-3 text-[13px] leading-relaxed text-neutral-400">
            <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-300">1</span> Add your store description, 512×512 icon, and screenshots.</li>
            <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[11px] font-bold text-neutral-300">2</span> Upload your signed APK with live byte-by-byte progress.</li>
            <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[11px] font-bold text-neutral-300">3</span> Review the release details and submit it for manual review.</li>
          </ol>
          <div className="mt-5 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-neutral-500">The package name must exactly match the APK and cannot be changed later. Every APK is reviewed before it goes live.</div>
        </Card>
      </div>
    </main>
  );
}
