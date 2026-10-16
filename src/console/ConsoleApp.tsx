import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BarChart3, Bell, CheckCircle2, ChevronRight, CircleAlert, Download,
  FileUp, HelpCircle, ImagePlus, LayoutDashboard, LogOut, MessageSquareText,
  LoaderCircle, PackagePlus, Plus, RotateCcw, Search, Settings, Smartphone, Star, UploadCloud, X,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { usePath } from '../lib/router';
import { AppIcon, Logo, SignInPrompt, StatusBadge, categoryName } from '../shared/ui';
import { BackendNotice } from '../shared/BackendNotice';
import { APK_GITHUB_LIMIT_BYTES, assertApkFile, formatBytes, formatCount, prepareImage } from '../lib/storage';
import { devApi, inspectApk, uploadApk, uploadImage } from '../lib/api';
import type { ApkManifestInfo, UploadedApk } from '../lib/api';
import type { StoreApp as StoreAppType } from '../types';

// ── Design tokens (dark, neutral #212121 - Material-style console) ──
const inputCls = 'w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15';
const labelCls = 'mb-1.5 block text-[13px] font-medium text-neutral-300';
const hintCls = 'mt-1 text-xs leading-relaxed text-neutral-500';
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40';
const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-transparent px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/5 disabled:opacity-40';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image'));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

function Card({ title, desc, children, action }: { title?: string; desc?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] shadow-sm">
      {(title || action) && (
        <header className="flex flex-wrap items-start gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[15px] font-semibold text-white">{title}</h2>}
            {desc && <p className="mt-0.5 text-[13px] text-neutral-400">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-neutral-400">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon: typeof Download }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-neutral-400">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/12 text-emerald-300"><Icon size={16} /></span>
      </div>
      <p className="mt-2 font-display text-[26px] font-semibold leading-none text-white">{value}</p>
      <p className="mt-1.5 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}

// ════════════════ SHELL ════════════════
function Shell({ children, navigate, path }: { children: React.ReactNode; navigate: (p: string) => void; path: string }) {
  const { user, developer, signOut } = useApp();
  const groups: { heading: string; items: [string, string, typeof LayoutDashboard][] }[] = [
    { heading: 'Overview', items: [['/', 'Dashboard', LayoutDashboard], ['/apps/new', 'Create app', PackagePlus]] },
    { heading: 'Insights', items: [['/stats', 'Statistics', BarChart3], ['/reviews', 'Reviews', MessageSquareText]] },
    { heading: 'Account', items: [['/settings', 'Developer profile', Settings]] },
  ];
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  return (
    <div className="min-h-dvh bg-[#212121] text-neutral-200 lg:flex">
      {/* Sidebar */}
      <aside className="z-30 border-b border-white/[0.07] bg-[#1d1d1d] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[264px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <Logo subtitle="Developer Console" />
        </div>
        {developer && (
          <div className="mx-3 mt-3 hidden items-center gap-3 rounded-xl border border-white/[0.07] bg-[#262626] px-3.5 py-3 lg:flex">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#333] font-display text-sm font-semibold text-white">
              {(developer.orgName || developer.displayName).charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{developer.orgName || developer.displayName}</span>
              <span className="block truncate text-xs text-neutral-500">@{developer.username}</span>
            </span>
          </div>
        )}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:flex-1 lg:space-y-5 lg:overflow-y-auto lg:py-4">
          {groups.map((g) => (
            <div key={g.heading} className="flex gap-1 lg:block">
              <p className="hidden px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 lg:block">{g.heading}</p>
              {g.items.map(([to, label, Icon]) => (
                <button key={to} onClick={() => navigate(to)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition lg:mb-0.5 lg:w-full ${isActive(to) ? 'bg-emerald-600/15 font-medium text-emerald-200' : 'text-neutral-300 hover:bg-white/[0.05] hover:text-white'}`}>
                  <Icon size={17} className={isActive(to) ? 'text-emerald-300' : 'text-neutral-500'} /> {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden border-t border-white/[0.06] p-4 lg:block">
          <div className="rounded-xl bg-[#262626] p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-white"><HelpCircle size={15} className="text-emerald-300" /> Publishing guide</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">Listing requirements, review policy, and APK upload rules (GitHub storefiles, up to 50 MB).</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-[#212121]/95 px-4 backdrop-blur sm:px-6">
          <p className="hidden text-sm text-neutral-500 md:block">
            Console <span className="mx-1.5 text-neutral-600">/</span>
            <span className="font-medium text-neutral-200">{path === '/' ? 'Dashboard' : path === '/apps/new' ? 'Create app' : path === '/stats' ? 'Statistics' : path === '/reviews' ? 'Reviews' : path === '/settings' ? 'Developer profile' : 'App'}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <label className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-[#2a2a2a] px-3 py-2 xl:flex">
              <Search size={15} className="text-neutral-500" />
              <input placeholder="Search apps" className="w-44 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" />
            </label>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg text-neutral-400 transition hover:bg-white/5 hover:text-white" aria-label="Notifications">
              <Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </button>
            <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
            <span className="hidden items-center gap-2.5 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3a3a3a] font-display text-sm font-semibold text-white">{user?.name.charAt(0)}</span>
              <span className="hidden leading-tight 2xl:block">
                <span className="block max-w-[150px] truncate text-[13px] font-medium text-white">{user?.name}</span>
                <span className="block max-w-[150px] truncate text-[11px] text-neutral-500">{user?.email}</span>
              </span>
            </span>
            <button onClick={signOut} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-neutral-400 transition hover:bg-white/5 hover:text-white">
              <LogOut size={16} /> <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <BackendNotice />
          {children}
        </div>
        <footer className="border-t border-white/[0.06] px-6 py-4 text-xs text-neutral-600">Gothwad Developer Console · console.gothwadtech.com</footer>
      </div>
    </div>
  );
}

// ════════════════ ONBOARDING ════════════════
function Onboarding() {
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
            I agree to the Gothwad Store Developer Policy. I confirm that my apps are my own work, are not pirated or modified versions of paid apps, and do not collect user data without disclosure.
          </label>
          <div className="flex justify-end gap-2.5 border-t border-white/[0.06] pt-4">
            <button disabled={!agree || saving} className={btnPrimary}>{saving ? <><LoaderCircle size={16} className="animate-spin" /> Creating profile…</> : 'Create developer profile'}</button>
          </div>
        </form>
      </Card>
    </main>
  );
}

// ════════════════ DASHBOARD ════════════════
function Dashboard({ navigate }: { navigate: (p: string) => void }) {
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
          <div className="-mx-5 -my-2 overflow-x-auto">
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
        ) : (
          <div className="py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#333] text-neutral-400"><Smartphone size={22} /></span>
            <p className="mt-3 font-medium text-white">No apps yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">Create your first app listing, upload an APK, and submit it for review.</p>
            <button onClick={() => navigate('/apps/new')} className={`${btnPrimary} mt-4`}><Plus size={16} /> Create app</button>
          </div>
        )}
      </Card>
    </main>
  );
}

// ════════════════ CREATE APP ════════════════
function CreateApp({ navigate }: { navigate: (p: string) => void }) {
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
      .then((created) => {
        // The setup page opens immediately after this request; the publishing
        // checklist then leads straight into listing artwork and APK upload.
        navigate(`/apps/${created.id}`);
      })
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

function PublishingChecklist({ app, releases, navigate }: { app: StoreAppType; releases: ReturnType<typeof useApp>['releases']; navigate: (path: string) => void }) {
  const listingReady = !!(app.name.trim() && app.shortDesc.trim() && app.fullDesc.trim() && app.iconUrl && app.screenshots.length >= 2 && app.supportEmail.trim());
  const hasRelease = releases.some((release) => release.appId === app.id);
  const pending = releases.find((release) => release.appId === app.id && release.reviewStatus === 'pending');
  const submitted = app.status === 'in_review' || releases.some((release) => release.appId === app.id && release.reviewStatus === 'approved');
  const steps = [
    { label: 'Complete store listing', done: listingReady, to: `/apps/${app.id}` },
    { label: 'Upload APK release', done: hasRelease, to: `/apps/${app.id}/releases` },
    { label: submitted ? 'Release submitted' : pending ? 'Submit for review' : 'Submit for review', done: submitted, to: `/apps/${app.id}/releases` },
  ];
  const next = steps.find((step) => !step.done);
  return (
    <section className="mb-5 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.045] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Publishing checklist</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {steps.map((step, index) => <button key={step.label} type="button" onClick={() => navigate(step.to)} className={`inline-flex items-center gap-1.5 text-xs transition hover:text-white ${step.done ? 'text-emerald-300' : 'text-neutral-400'}`}><span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${step.done ? 'bg-emerald-500 text-white' : 'border border-white/20 text-neutral-400'}`}>{step.done ? '✓' : index + 1}</span>{step.label}</button>)}
          </div>
        </div>
        {next && <button type="button" onClick={() => navigate(next.to)} className={`${btnPrimary} shrink-0`}>Continue: {next.label}<ChevronRight size={15} /></button>}
      </div>
    </section>
  );
}

// ════════════════ APP DETAIL (listing / releases / reviews) ════════════════
function AppDetail({ app, navigate, tab }: { app: StoreAppType; navigate: (p: string) => void; tab: 'listing' | 'releases' | 'reviews' }) {
  const { updateApp, categories, releases, addRelease, submitForReview, submissions, reviews, replyReview, setAppStatus, liveReleaseOf, backendLive, demoModeAvailable, isDemoUser } = useApp();
  const isLocalDemo = demoModeAvailable && isDemoUser;
  const apiMode = backendLive && !isDemoUser;
  const [form, setForm] = useState(app);
  const [iconName, setIconName] = useState('');
  const [shots, setShots] = useState<string[]>(app.screenshots);
  const [imageUpload, setImageUpload] = useState<{ target: 'icon' | 'shot'; phase: 'Preparing image…' | 'Uploading image…'; progress: number } | null>(null);
  const [apk, setApk] = useState<{
    name: string; size: number; file: File; manifest?: ApkManifestInfo | null; sha256?: string;
    inspection: 'checking' | 'ready' | 'skipped' | 'failed'; inspectError?: string;
  } | null>(null);
  const [ver, setVer] = useState({ versionName: '', versionCode: '', changelog: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [listingSaving, setListingSaving] = useState(false);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const inspectAbortRef = useRef<AbortController | null>(null);
  const selectedApkRef = useRef<File | null>(null);
  const appReleases = releases.filter((r) => r.appId === app.id).sort((a, b) => b.versionCode - a.versionCode);
  const appReviews = reviews.filter((r) => r.appId === app.id);
  const rejected = submissions.find((s) => s.appId === app.id && s.status === 'rejected');
  const live = liveReleaseOf(app.id);
  const apkPackageMismatch = !!(apk?.manifest?.packageName && apk.manifest.packageName !== app.packageName);
  const validVersionCode = Number.isInteger(Number(ver.versionCode)) && Number(ver.versionCode) > 0;
  const canCreateRelease = !!apk && !!ver.versionName.trim() && validVersionCode && !apkPackageMismatch && !releaseBusy;

  const onImage = async (file: File | undefined, target: 'icon' | 'shot') => {
    if (!file || imageUpload || (target === 'shot' && shots.length >= 8)) return;
    setError('');
    setMsg('');
    setImageUpload({ target, phase: 'Preparing image…', progress: 0 });
    try {
      const prepared = await prepareImage(file, target === 'icon' ? 'icon' : 'screenshot');
      let url: string;
      if (isLocalDemo) {
        url = await blobToDataUrl(prepared.blob);
      } else {
        if (!apiMode) throw new Error('Image uploads are unavailable while the Store service is offline.');
        setImageUpload({ target, phase: 'Uploading image…', progress: 0 });
        url = await uploadImage(prepared.blob, file.name, { onProgress: (fraction) => setImageUpload({ target, phase: 'Uploading image…', progress: Math.round(fraction * 100) }) });
      }
      if (target === 'icon') {
        setForm((current) => ({ ...current, iconUrl: url }));
        setIconName(file.name);
      } else {
        setShots((current) => current.length >= 8 ? current : [...current, url]);
      }
      setMsg(target === 'icon' ? 'Icon ready. Save the listing to keep it.' : 'Screenshot ready. Save the listing to keep it.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image upload failed. Please try again.');
    } finally {
      setImageUpload(null);
    }
  };

  const inspectSelectedApk = (file: File) => {
    inspectAbortRef.current?.abort();
    const controller = new AbortController();
    inspectAbortRef.current = controller;
    setApk((current) => current?.file === file ? { ...current, inspection: 'checking', inspectError: undefined } : current);
    void inspectApk(file, controller.signal)
      .then(({ manifest, sha256 }) => {
        if (controller.signal.aborted || selectedApkRef.current !== file) return;
        setApk((current) => current?.file === file ? { ...current, manifest, sha256, inspection: 'ready', inspectError: undefined } : current);
        if (manifest.packageName && manifest.packageName !== app.packageName) {
          setError(`This APK is for ${manifest.packageName}, but this listing is ${app.packageName}. Choose the correct APK.`);
          return;
        }
        setVer((current) => ({
          ...current,
          versionName: current.versionName || manifest.versionName || '',
          versionCode: current.versionCode || (manifest.versionCode ? String(manifest.versionCode) : ''),
        }));
        if (manifest.versionName || manifest.versionCode) setMsg('APK details were read automatically. Review them, then create the release.');
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || selectedApkRef.current !== file) return;
        const detail = reason instanceof Error ? reason.message : 'APK inspection failed.';
        setApk((current) => current?.file === file ? { ...current, inspection: 'failed', inspectError: detail } : current);
        setMsg('We could not read APK metadata automatically. You can still enter the version details and upload; the package is verified again during upload.');
      });
  };

  const onApkFile = (file: File | undefined) => {
    if (!file) return;
    setError('');
    setMsg('');
    try {
      assertApkFile(file);
    } catch (reason) {
      setApk(null);
      setError(reason instanceof Error ? reason.message : 'Choose a valid APK file.');
      return;
    }
    if (!apiMode && !isLocalDemo) {
      setApk(null);
      setError('APK uploads are unavailable while the Store service is offline.');
      return;
    }

    inspectAbortRef.current?.abort();
    selectedApkRef.current = file;
    const deferInspection = file.size > 25 * 1024 * 1024;
    setApk({ name: file.name, size: file.size, file, inspection: isLocalDemo ? 'skipped' : deferInspection ? 'skipped' : 'checking' });
    if (isLocalDemo) {
      setMsg('Preview only: this APK will not be uploaded or stored. Enter version details and create a local demo release.');
      return;
    }
    if (deferInspection) {
      // Do not send the same large file twice before the actual upload. The
      // optional check remains available, while the release upload can begin promptly.
      setMsg('Large APK selected. Enter its version details and upload when ready; metadata checking is optional and will not block the upload.');
      return;
    }
    setMsg('Checking APK package and version in the background… You can fill the release notes while this runs.');
    inspectSelectedApk(file);
  };

  const retryInspection = () => {
    if (!apk || isLocalDemo) return;
    setError('');
    setMsg('Checking APK metadata in the background…');
    inspectSelectedApk(apk.file);
  };

  const tabs: [typeof tab, string][] = [['listing', 'Store listing'], ['releases', `Releases`], ['reviews', `Reviews`]];

  return (
    <main>
      <button onClick={() => navigate('/')} className="mb-4 flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-white"><ArrowLeft size={15} /> All apps</button>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <AppIcon app={app} size={56} rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-white">{app.name}</h1>
          <p className="truncate text-[13px] text-neutral-500">{app.packageName} · {categoryName(app.category)}{live ? ` · v${live.versionName} live` : ''}</p>
        </div>
        <StatusBadge status={app.status} />
        {app.status === 'published' && <button onClick={() => { void setAppStatus(app.id, 'unlisted').catch((err: Error) => setError(err.message)); }} className={btnGhost}>Unpublish</button>}
        {app.status === 'unlisted' && <button onClick={() => { void setAppStatus(app.id, 'published').catch((err: Error) => setError(err.message)); }} className={btnPrimary}>Publish again</button>}
      </div>

      {rejected?.note && app.status === 'draft' && (
        <p className="mb-5 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200"><b>Reviewer note:</b> {rejected.note}</p>
      )}
      <PublishingChecklist app={{ ...app, ...form, screenshots: shots }} releases={releases} navigate={navigate} />
      {msg && <p className="mb-5 flex gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-200"><CheckCircle2 size={18} className="shrink-0" /> {msg}</p>}
      {error && <p className="mb-5 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200"><b>Error:</b> {error}</p>}

      <div className="mb-6 flex gap-1 border-b border-white/[0.08]">
        {tabs.map(([t, l]) => (
          <button key={t} onClick={() => navigate(t === 'listing' ? `/apps/${app.id}` : `/apps/${app.id}/${t}`)}
            className={`relative px-4 py-2.5 text-sm transition ${tab === t ? 'font-medium text-white' : 'text-neutral-400 hover:text-neutral-200'}`}>
            {l}{t === 'reviews' && appReviews.length > 0 ? ` (${appReviews.length})` : t === 'releases' && appReleases.length > 0 ? ` (${appReleases.length})` : ''}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-emerald-500" />}
          </button>
        ))}
      </div>

      {tab === 'listing' && (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (listingSaving) return;
          const submitter = event.nativeEvent.submitter as HTMLButtonElement | null;
          const continueToRelease = submitter?.value === 'continue';
          if (continueToRelease && !(form.name.trim() && form.shortDesc.trim() && form.fullDesc.trim() && form.iconUrl && shots.length >= 2 && form.supportEmail.trim())) {
            setError('Complete the description, icon, at least 2 screenshots, and support email before continuing to APK upload.');
            return;
          }
          setError('');
          setListingSaving(true);
          void updateApp(app.id, {
            name: form.name.trim(), category: form.category, shortDesc: form.shortDesc.trim(), fullDesc: form.fullDesc.trim(),
            iconUrl: form.iconUrl, supportEmail: form.supportEmail.trim(), privacyPolicyUrl: form.privacyPolicyUrl?.trim() || '',
            screenshots: shots,
          }).then(() => {
            setMsg(continueToRelease ? 'Listing saved. Opening APK upload…' : 'Store listing saved. APKs always require review.');
            if (continueToRelease) window.setTimeout(() => navigate(`/apps/${app.id}/releases`), 350);
          }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Store listing could not be saved.')).finally(() => setListingSaving(false));
        }}>
          <div className="space-y-5">
            <Card title="App details" desc="How your app appears on Gothwad Store.">
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><label className={labelCls}>App name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required /></div>
                  <div><label className={labelCls}>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
                </div>
                <div>
                  <label className={labelCls}>Short description</label>
                  <input maxLength={80} value={form.shortDesc} onChange={(e) => setForm({ ...form, shortDesc: e.target.value })} className={inputCls} placeholder="One line that explains what your app does" />
                  <p className="mt-1 text-right text-[11px] text-neutral-600">{form.shortDesc.length} / 80</p>
                </div>
                <div><label className={labelCls}>Full description</label><textarea rows={7} value={form.fullDesc} onChange={(e) => setForm({ ...form, fullDesc: e.target.value })} className={inputCls} placeholder="Describe your app, its key features, and who it is for." /></div>
              </div>
            </Card>

            <Card title="Graphics" desc="PNG, JPG, and WebP are converted to reliable, size-limited WebP files before they are sent to ImgBB.">
              <div className="space-y-5">
                <div>
                  <label className={labelCls}>App icon <span className="text-red-300">*</span> · 512 × 512</label>
                  <div className="flex flex-wrap items-center gap-4">
                    {form.iconUrl ? <img src={form.iconUrl} alt="Current app icon" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#333] font-display text-xl font-semibold text-white">{form.name.charAt(0)}</span>}
                    <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void onImage(event.dataTransfer.files?.[0], 'icon'); }} className={`${btnGhost} ${imageUpload ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                      {imageUpload?.target === 'icon' ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                      {imageUpload?.target === 'icon' ? `${imageUpload.phase} ${imageUpload.phase === 'Uploading image…' ? `${imageUpload.progress}%` : ''}` : iconName || 'Upload icon'}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={!!imageUpload} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void onImage(file, 'icon'); }} />
                    </label>
                    <span className="text-xs text-neutral-500">Drop or choose · max 20 MB source</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Screenshots <span className="text-red-300">*</span> · at least 2 required</label>
                  <div className="flex flex-wrap gap-3">
                    {shots.map((shot, index) => (
                      <span key={shot} className="group relative">
                        <img src={shot} alt={`Screenshot ${index + 1}`} className="h-40 w-[90px] rounded-lg object-cover ring-1 ring-white/10" />
                        <button type="button" onClick={() => setShots((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove screenshot ${index + 1}`}><X size={13} /></button>
                      </span>
                    ))}
                    <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void onImage(event.dataTransfer.files?.[0], 'shot'); }} className={`grid h-40 w-[90px] place-items-center rounded-lg border border-dashed border-white/20 text-neutral-400 transition hover:border-emerald-500/50 hover:text-emerald-300 ${imageUpload || shots.length >= 8 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                      <span className="flex flex-col items-center gap-1.5 px-1 text-center text-xs font-medium">{imageUpload?.target === 'shot' ? <><LoaderCircle size={19} className="animate-spin" /><span>{imageUpload.phase === 'Uploading image…' ? `${imageUpload.progress}%` : 'Preparing…'}</span></> : <><ImagePlus size={19} /><span>{shots.length >= 8 ? 'Maximum 8' : 'Add'}</span></>}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={!!imageUpload || shots.length >= 8} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void onImage(file, 'shot'); }} />
                    </label>
                  </div>
                  <p className={hintCls}>{shots.length}/8 screenshots added. Portrait screenshots look best in the Store.</p>
                </div>
              </div>
            </Card>

            <Card title="Contact & privacy">
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={labelCls}>Support email</label><input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Privacy policy URL</label><input value={form.privacyPolicyUrl ?? ''} onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })} className={inputCls} placeholder="https://example.com/privacy" /><p className={hintCls}>Required if your app collects personal data.</p></div>
              </div>
            </Card>

            <div className="sticky bottom-4 flex flex-wrap justify-end gap-2.5 rounded-xl border border-white/[0.08] bg-[#2a2a2a]/95 px-4 py-3 shadow-xl shadow-black/30 backdrop-blur">
              <button type="button" disabled={listingSaving || !!imageUpload} onClick={() => { setForm(app); setShots(app.screenshots); setIconName(''); }} className={btnGhost}>Discard changes</button>
              <button type="submit" value="continue" disabled={listingSaving || !!imageUpload} className={btnPrimary}>{listingSaving ? <><LoaderCircle size={15} className="animate-spin" /> Saving…</> : <>Save & continue to APK <ChevronRight size={15} /></>}</button>
              <button type="submit" value="save" disabled={listingSaving || !!imageUpload} className={btnGhost}>{listingSaving ? <><LoaderCircle size={15} className="animate-spin" /> Saving…</> : 'Save listing'}</button>
            </div>
          </div>
        </form>
      )}

      {tab === 'releases' && (
        <div className="space-y-5">
          <Card title="Upload a new release" desc="Every supported APK is uploaded to GitHub storefiles through the Store Worker (up to 50 MB), with live byte-by-byte progress.">
            <form className="space-y-5" onSubmit={(event) => {
              event.preventDefault();
              if (!apk || !canCreateRelease) return;
              setError('');
              setMsg('');
              setReleaseBusy(true);
              void (async () => {
                try {
                  let uploaded: UploadedApk | undefined;
                  if (apiMode) {
                    if (apkPackageMismatch) throw new Error(`This APK is for ${apk.manifest?.packageName}, but this listing is ${app.packageName}.`);
                    setUploadPct(0);
                    uploaded = await uploadApk(apk.file, app, Number(ver.versionCode), { onProgress: (fraction) => setUploadPct(Math.round(fraction * 100)) });
                  }
                  const rel = await addRelease(app.id, {
                    versionName: ver.versionName.trim(), versionCode: Number(ver.versionCode), sizeBytes: apk.size,
                    changelog: ver.changelog.trim(), permissions: apk.manifest?.permissions?.length ? apk.manifest.permissions : ['android.permission.INTERNET'],
                    apkName: apk.name, apkUrl: uploaded?.url, apkProvider: uploaded?.provider, apkKey: uploaded?.key,
                    apkSha256: uploaded?.sha256 ?? apk.sha256, manifest: uploaded?.manifest ?? apk.manifest ?? undefined,
                  });
                  setMsg(isLocalDemo
                    ? `Preview release v${rel.versionName} created locally (${formatBytes(apk.size)}). No APK was uploaded; submit the demo release for review below.`
                    : `Release v${rel.versionName} created and stored in GitHub · storefiles. Submit it for review below.`);
                  selectedApkRef.current = null;
                  setApk(null);
                  setVer({ versionName: '', versionCode: '', changelog: '' });
                } catch (reason) {
                  setError(reason instanceof Error ? reason.message : 'Release creation failed. Please try again.');
                } finally {
                  setUploadPct(null);
                  setReleaseBusy(false);
                }
              })();
            }}>
              <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onApkFile(event.dataTransfer.files?.[0]); }} className={`flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 bg-[#242424] px-4 py-9 text-center transition hover:border-emerald-500/50 ${releaseBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                {releaseBusy ? <LoaderCircle size={30} className="animate-spin text-emerald-400" /> : <UploadCloud size={30} className="text-emerald-400" />}
                <span className="text-sm font-medium text-white">{apk ? `${apk.name} · ${formatBytes(apk.size)}` : 'Choose an APK file or drop it here'}</span>
                <span className="max-w-xl text-xs leading-relaxed text-neutral-500">{apk ? `GitHub storefiles · secure Worker upload · up to ${formatBytes(APK_GITHUB_LIMIT_BYTES)}` : 'Use a signed release APK. Android App Bundles (.aab) are not supported yet.'}</span>
                <input type="file" accept=".apk,application/vnd.android.package-archive" className="hidden" disabled={releaseBusy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; onApkFile(file); }} />
              </label>

              {apk && (
                <div className={`rounded-lg border px-3.5 py-3 text-xs leading-relaxed ${apkPackageMismatch ? 'border-red-400/25 bg-red-500/[0.08] text-red-200' : 'border-white/[0.08] bg-white/[0.035] text-neutral-400'}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-medium text-neutral-200">Preflight:</span>
                    {apk.inspection === 'checking' && <span className="inline-flex items-center gap-1.5 text-sky-200"><LoaderCircle size={13} className="animate-spin" /> Reading package and version in background…</span>}
                    {apk.inspection === 'ready' && <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 size={13} /> APK metadata checked</span>}
                    {apk.inspection === 'skipped' && <span>Skipped for this large APK so the direct upload can start promptly.</span>}
                    {apk.inspection === 'failed' && <span>Automatic check did not finish. The APK will be checked again during upload where possible.</span>}
                    {(apk.inspection === 'skipped' || apk.inspection === 'failed') && !releaseBusy && <button type="button" onClick={retryInspection} className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"><RotateCcw size={12} /> Check now</button>}
                  </div>
                  {apk.inspectError && <p className="mt-1.5 text-neutral-500">{apk.inspectError}</p>}
                  {apk.manifest && <p className="mt-1.5">Package <span className="font-medium text-neutral-200">{apk.manifest.packageName ?? 'not found'}</span>{apk.manifest.minSdk ? <> · min SDK {apk.manifest.minSdk}</> : null}{apk.manifest.targetSdk ? <> · target SDK {apk.manifest.targetSdk}</> : null}{apk.manifest.permissions.length ? <> · {apk.manifest.permissions.length} permissions</> : null}</p>}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={labelCls}>Version name</label><input required disabled={releaseBusy} value={ver.versionName} onChange={(event) => setVer({ ...ver, versionName: event.target.value })} className={inputCls} placeholder="1.0.0" /></div>
                <div><label className={labelCls}>Version code</label><input required disabled={releaseBusy} type="number" min={1} step={1} value={ver.versionCode} onChange={(event) => setVer({ ...ver, versionCode: event.target.value })} className={inputCls} placeholder="1" /><p className={hintCls}>A positive integer that increases with every release.</p></div>
              </div>
              <div><label className={labelCls}>Release notes</label><textarea disabled={releaseBusy} rows={3} value={ver.changelog} onChange={(event) => setVer({ ...ver, changelog: event.target.value })} className={inputCls} placeholder="What is new in this version?" /></div>
              <div className="border-t border-white/[0.06] pt-4">
                {releaseBusy && <div className="mb-3">
                  <div className="flex justify-between text-xs text-neutral-400"><span>{uploadPct === null ? 'Finalizing release…' : uploadPct >= 100 ? 'Upload received — validating and saving release…' : 'Uploading APK securely…'}</span><span>{uploadPct ?? 100}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${uploadPct ?? 100}%` }} /></div>
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">Keep this tab open until the release is created. If the connection drops, selecting the same APK and trying again is safe.</p>
                </div>}
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {!apk && <span className="mr-auto text-xs text-neutral-500">Choose an APK to begin.</span>}
                  {apkPackageMismatch && <span className="mr-auto text-xs text-red-300">This package does not match the listing.</span>}
                  <button disabled={!canCreateRelease} className={btnPrimary}>{releaseBusy ? <><LoaderCircle size={16} className="animate-spin" /> Creating release…</> : <><FileUp size={16} /> Upload & create release</>}</button>
                </div>
              </div>
            </form>
          </Card>

          <Card title="Release history" desc={live ? `Currently live: v${live.versionName} (${live.versionCode})` : 'Nothing is live yet. Your first approved release will appear here.'}>
            {appReleases.length ? (
              <div className="-mx-5 -my-2 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead><tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-5 py-2.5 font-semibold">Version</th><th className="px-3 py-2.5 font-semibold">Size</th><th className="px-3 py-2.5 font-semibold">Storage</th>
                    <th className="px-3 py-2.5 font-semibold">Review</th><th className="px-3 py-2.5 text-right font-semibold">Downloads</th><th className="px-3 py-2.5 text-right font-semibold">Action</th>
                  </tr></thead>
                  <tbody>{appReleases.map((release) => (
                    <tr key={release.id} className="border-b border-white/[0.05] last:border-0">
                      <td className="px-5 py-3"><span className="font-medium text-white">v{release.versionName}</span> <span className="text-xs text-neutral-500">({release.versionCode})</span>{release.isLive && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/25">Live</span>}</td>
                      <td className="px-3 py-3 text-neutral-400">{formatBytes(release.apkSizeBytes)}</td>
                      <td className="px-3 py-3 text-neutral-400">GitHub</td>
                      <td className="px-3 py-3"><span className={release.reviewStatus === 'approved' ? 'text-emerald-300' : release.reviewStatus === 'rejected' ? 'text-red-300' : 'text-amber-300'}>{release.reviewStatus === 'approved' ? 'Approved' : release.reviewStatus === 'rejected' ? 'Rejected' : 'Pending'}</span>{release.reviewStatus === 'rejected' && release.reviewNote ? <span className="block max-w-[220px] truncate text-xs text-neutral-500" title={release.reviewNote}>{release.reviewNote}</span> : null}</td>
                      <td className="px-3 py-3 text-right text-neutral-300">{formatCount(release.downloads)}</td>
                      <td className="px-3 py-3 text-right">
                        {release.reviewStatus === 'pending' && app.status !== 'in_review'
                          ? <button onClick={() => { setError(''); void submitForReview(app.id, release.id).then(() => setMsg('Submitted for review. Once an admin approves it, this version will go live.')).catch((reason: Error) => setError(reason.message)); }} className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400">Submit for review</button>
                          : <span className="text-xs text-neutral-600">—</span>}
                      </td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-6 text-center text-sm text-neutral-500">No releases yet. Upload your first APK above.</p>}
          </Card>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4">
          {appReviews.map((r) => (
            <section key={r.id} className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3a3a3a] text-xs font-semibold text-white">{r.username.charAt(0).toUpperCase()}</span>
                <b className="text-sm text-white">@{r.username}</b>
                <span className="text-amber-300">{'★'.repeat(r.rating)}<span className="text-neutral-700">{'★'.repeat(5 - r.rating)}</span></span>
                <span className="ml-auto text-xs text-neutral-600">{new Date(r.createdAt).toLocaleDateString('en-US')}</span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">{r.body}</p>
              {r.developerReply
                ? <p className="mt-3 rounded-lg bg-[#242424] px-3.5 py-2.5 text-[13px] text-neutral-300"><b className="text-emerald-300">Your reply: </b>{r.developerReply}</p>
                : <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setError(''); void replyReview(r.id, replyDraft[r.id] ?? '').then(() => setReplyDraft((current) => ({ ...current, [r.id]: '' }))).catch((reason: Error) => setError(reason.message)); }}>
                    <input value={replyDraft[r.id] ?? ''} onChange={(e) => setReplyDraft({ ...replyDraft, [r.id]: e.target.value })} placeholder="Reply as the developer…" className={inputCls} />
                    <button className={`${btnPrimary} shrink-0`}>Reply</button>
                  </form>}
            </section>
          ))}
          {!appReviews.length && <Card><p className="py-6 text-center text-sm text-neutral-500">No reviews yet for this app.</p></Card>}
        </div>
      )}
    </main>
  );
}

// ════════════════ STATS / REVIEWS / SETTINGS ════════════════
function StatsPage() {
  const { apps, developer, demoModeAvailable, isDemoUser } = useApp();
  const mine = useMemo(() => apps.filter((app) => app.developerId === developer?.id), [apps, developer?.id]);
  const [statsByApp, setStatsByApp] = useState<Record<string, Awaited<ReturnType<typeof devApi.stats>>>>({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!mine.length) {
      setStatsByApp({});
      setStatsLoading(false);
      setStatsError('');
      return () => { cancelled = true; };
    }
    if (demoModeAvailable && isDemoUser) {
      const previews = mine.map((app) => {
        const baseline = Math.max(0, Math.round(Math.log10(app.downloadsCount + 1)));
        const days = Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - index));
          const sampleFactor = 0.5 + ((index * 17 + app.id.length) % 10) / 10;
          return { date: date.toISOString().slice(0, 10), count: Math.round(baseline * sampleFactor) };
        });
        return [app.id, { days, totalDownloads: app.downloadsCount, ratingAvg: app.ratingAvg, ratingCount: app.ratingCount }] as const;
      });
      setStatsByApp(Object.fromEntries(previews));
      setStatsLoading(false);
      setStatsError('');
      return () => { cancelled = true; };
    }
    setStatsLoading(true);
    setStatsError('');
    void Promise.all(mine.map(async (app) => [app.id, await devApi.stats(app.id, 7)] as const))
      .then((entries) => {
        if (!cancelled) setStatsByApp(Object.fromEntries(entries));
      })
      .catch((error: Error) => {
        if (!cancelled) setStatsError(error.message || 'Statistics could not be loaded.');
      })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [mine, demoModeAvailable, isDemoUser]);

  const weekTotal = Object.values(statsByApp).reduce((total, stats) =>
    total + stats.days.reduce((sum, day) => sum + day.count, 0), 0);
  return (
    <main>
      <PageHeader title="Statistics" desc={demoModeAvailable && isDemoUser
        ? 'Illustrative demo activity only; these preview values are not recorded download events.'
        : 'Daily downloads recorded by the Store for the last 7 days.'} />
      <div className="mb-6 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard label="Downloads (7 days)" value={statsLoading || statsError ? '—' : formatCount(weekTotal)} sub="Across your apps" icon={Download} />
        <StatCard label="Published apps" value={String(mine.filter((app) => app.status === 'published').length)} sub="Currently live on the store" icon={Smartphone} />
        <StatCard label="Total downloads" value={formatCount(mine.reduce((total, app) => total + app.downloadsCount, 0))} sub="All time" icon={BarChart3} />
        <StatCard label="Total ratings" value={formatCount(mine.reduce((total, app) => total + app.ratingCount, 0))} sub="Across your apps" icon={Star} />
      </div>
      <div className="space-y-5">
        {statsLoading && <Card><p className="py-8 text-center text-sm text-neutral-400">Loading live download statistics…</p></Card>}
        {!statsLoading && statsError && <Card><div className="py-6 text-center"><p className="text-sm text-red-200">{statsError}</p><button onClick={() => window.location.reload()} className={`${btnGhost} mt-4`}><X size={14} /> Reload</button></div></Card>}
        {!statsLoading && !statsError && mine.map((app) => {
          const days = statsByApp[app.id]?.days ?? [];
          const maxCount = Math.max(1, ...days.map((day) => day.count));
          return (
            <Card key={app.id} title={app.name} desc={`${formatCount(app.downloadsCount)} total downloads · ${app.ratingAvg.toFixed(1)} average rating (${formatCount(app.ratingCount)} ratings)`}>
              {days.some((day) => day.count > 0) ? (
                <div className="flex h-36 items-end gap-2.5">
                  {days.map((day) => (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                      <span className="w-full rounded-t-md bg-emerald-600/80 transition hover:bg-emerald-500" style={{ height: day.count === 0 ? '0%' : `${Math.max(5, (day.count / maxCount) * 100)}%` }} title={`${day.date}: ${formatCount(day.count)} downloads`} />
                      <span className="text-[11px] text-neutral-500">{new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="py-8 text-center text-sm text-neutral-500">No downloads were recorded in the last 7 days.</p>}
            </Card>
          );
        })}
        {!statsLoading && !statsError && !mine.length && <Card><p className="py-8 text-center text-sm text-neutral-500">Create your first app to see download statistics.</p></Card>}
      </div>
    </main>
  );
}

function ReviewsPage() {
  const { apps, developer, reviews, replyReview } = useApp();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const mine = reviews.filter((r) => apps.some((a) => a.id === r.appId && a.developerId === developer?.id));
  return (
    <main>
      <PageHeader title="Reviews" desc="Reviews across all of your apps. Public replies build trust with users." />
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3.5 py-3 text-sm text-red-200">{error}</p>}
      <div className="space-y-4">
        {mine.map((r) => { const a = apps.find((x) => x.id === r.appId); return (
          <section key={r.id} className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-4">
            <p className="text-xs text-neutral-500">{a?.name} · <span className="font-medium text-neutral-300">@{r.username}</span></p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-200">{r.body}</p>
            {!r.developerReply
              ? <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setError(''); void replyReview(r.id, draft[r.id] ?? '').then(() => setDraft((current) => ({ ...current, [r.id]: '' }))).catch((reason: Error) => setError(reason.message)); }}><input value={draft[r.id] ?? ''} onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })} className={inputCls} placeholder="Write a public reply…" /><button className={`${btnPrimary} shrink-0`}>Reply</button></form>
              : <p className="mt-2.5 text-[13px] text-neutral-400"><b className="text-emerald-300">You: </b>{r.developerReply}</p>}
          </section>);})}
        {!mine.length && <Card><p className="py-8 text-center text-sm text-neutral-500">No reviews yet.</p></Card>}
      </div>
    </main>
  );
}

function SettingsPage() {
  const { developer, registerDeveloper, user } = useApp();
  const [form, setForm] = useState({ displayName: developer?.displayName ?? '', orgName: developer?.orgName ?? '', supportEmail: developer?.supportEmail ?? '', website: developer?.website ?? '' });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!developer) return null;
  return (
    <main className="max-w-3xl">
      <PageHeader title="Developer profile" desc="Public publisher information shown on your listings." />
      <div className="space-y-5">
        <Card title="Profile">
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (saving) return; setSaving(true); setSaved(false); setError(''); void registerDeveloper(form).then(() => setSaved(true)).catch((reason: Error) => setError(reason.message)).finally(() => setSaving(false)); }}>
            {error && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3.5 py-3 text-sm text-red-200">{error}</p>}
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={labelCls}>Name</label><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={inputCls} required /></div>
              <div><label className={labelCls}>Organization name</label><input value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} className={inputCls} required /></div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={labelCls}>Support email</label><input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className={inputCls} required /></div>
              <div><label className={labelCls}>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
              {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-300"><CheckCircle2 size={15} /> Saved</span>}
              <button disabled={saving} className={btnPrimary}>{saving ? <><LoaderCircle size={16} className="animate-spin" /> Saving…</> : 'Save changes'}</button>
            </div>
          </form>
        </Card>
        <Card title="Gothwad Account" desc="Identity is managed by Gothwad Accounts, not here.">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-neutral-500">Username</dt><dd className="mt-0.5 font-medium text-white">@{user?.username}</dd></div>
            <div><dt className="text-neutral-500">Email</dt><dd className="mt-0.5 font-medium text-white">{user?.email}</dd></div>
          </dl>
          <p className={hintCls}>To change your name, password, or security settings, visit accounts.gothwadtech.com.</p>
        </Card>
      </div>
    </main>
  );
}

// ════════════════ CALLBACK + ROOT ════════════════
function Callback() {
  const { setUser } = useApp();
  const [msg, setMsg] = useState('Returning from Gothwad Accounts…');
  useEffect(() => {
    void import('../lib/auth').then((m) =>
      m.handleOAuthCallback().then((r) => {
        if ('user' in r) { setUser(r.user); setMsg('Signed in! Opening your dashboard…'); setTimeout(() => window.location.replace('/'), 600); }
        else setMsg(`We could not sign you in (${r.error}).`);
      }),
    );
  }, [setUser]);
  return <main className="mx-auto max-w-md px-4 py-24 text-center text-neutral-300">{msg}</main>;
}

export default function ConsoleApp() {
  const [path, navigate] = usePath();
  const { user, developer, apps, authReady, backendLive, demoModeAvailable, isDemoUser } = useApp();
  if (path === '/auth/callback') return <div className="min-h-dvh bg-[#212121] text-neutral-200"><Callback /></div>;
  if (!authReady) return <div className="grid min-h-dvh place-items-center bg-[#212121] text-neutral-400">Checking your Gothwad Account…</div>;
  if (!user) return <div className="min-h-dvh bg-[#212121]"><SignInPrompt what="Developer Console" /></div>;
  if (!backendLive && !(demoModeAvailable && isDemoUser)) return <div className="min-h-dvh bg-[#212121] px-4 py-12 text-neutral-300"><BackendNotice /><p className="mx-auto mt-5 max-w-xl text-center text-sm text-neutral-400">Developer tools are unavailable until the Store service is connected.</p></div>;
  if (!developer && path !== '/onboarding') {
    return <Shell navigate={navigate} path={path}><Onboarding /></Shell>;
  }
  let page: React.ReactNode = <Dashboard navigate={navigate} />;
  if (path === '/onboarding') page = <Onboarding />;
  else if (path === '/apps/new') page = <CreateApp navigate={navigate} />;
  else if (path.startsWith('/apps/')) {
    const rest = path.slice(6);
    const [id, sub] = rest.split('/');
    const app = apps.find((a) => a.id === id && a.developerId === developer?.id);
    const tab = sub === 'releases' ? 'releases' : sub === 'reviews' ? 'reviews' : 'listing';
    page = app ? <AppDetail app={app} navigate={navigate} tab={tab} /> : <main className="py-16 text-center text-neutral-400">This app was not found, or it does not belong to your developer profile.</main>;
  } else if (path === '/stats') page = <StatsPage />;
  else if (path === '/reviews') page = <ReviewsPage />;
  else if (path === '/settings') page = <SettingsPage />;
  return <Shell navigate={navigate} path={path}>{page}</Shell>;
}
